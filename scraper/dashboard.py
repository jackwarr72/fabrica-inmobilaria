import sqlite3
import json
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
import streamlit as st

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "properties.db"
SOURCES_PATH = BASE_DIR / "sources.json"

st.set_page_config(page_title="Fábrica Inmobiliaria Dashboard", page_icon="🏢", layout="wide")

st.title("🏢 Fábrica Inmobiliaria - Executive Dashboard")
st.markdown("Welcome to your centralized real estate intelligence hub. Browse, filter, and analyze scraped listings in real-time.")


@st.cache_data(ttl=60)
def load_data():
    with sqlite3.connect(DATABASE_PATH) as conn:
        df = pd.read_sql(
            """
            SELECT properties.*, sources.agency_name, sources.start_url, sources.enabled
            FROM properties
            LEFT JOIN sources ON sources.source_id = properties.source_id
            """,
            conn,
        )
    return df


@st.cache_data(ttl=15)
def load_sources():
    if not SOURCES_PATH.exists():
        return pd.DataFrame(columns=["source_id", "agency_name", "start_url", "enabled"])
    with SOURCES_PATH.open("r", encoding="utf-8") as source_file:
        sources = json.load(source_file)
    return pd.DataFrame(sources, columns=["source_id", "agency_name", "start_url", "enabled"])


def save_sources(sources_df):
    cleaned_sources = []
    seen_ids = set()
    seen_urls = set()

    for row in sources_df.to_dict("records"):
        agency_name = str(row.get("agency_name") or "").strip()
        start_url = str(row.get("start_url") or "").strip()
        parsed_url = urlparse(start_url)

        if not agency_name or not start_url:
            raise ValueError("Every website needs an agency name and start URL.")
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise ValueError(f"Invalid URL: {start_url}")

        source_id = row.get("source_id")
        source_id = int(source_id) if pd.notna(source_id) else None
        if source_id is None or source_id <= 0:
            source_id = (max(seen_ids) if seen_ids else 0) + 1
        if source_id in seen_ids:
            raise ValueError(f"Duplicate source ID: {source_id}")
        if start_url in seen_urls:
            raise ValueError(f"Duplicate URL: {start_url}")

        seen_ids.add(source_id)
        seen_urls.add(start_url)
        cleaned_sources.append(
            {
                "source_id": source_id,
                "agency_name": agency_name,
                "start_url": start_url,
                "enabled": bool(row.get("enabled", True)),
            }
        )

    with SOURCES_PATH.open("w", encoding="utf-8") as source_file:
        json.dump(cleaned_sources, source_file, ensure_ascii=False, indent=2)
        source_file.write("\n")

    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sources (
                source_id INTEGER PRIMARY KEY,
                agency_name TEXT NOT NULL,
                start_url TEXT NOT NULL,
                enabled INTEGER NOT NULL
            )
            """
        )
        for source in cleaned_sources:
            conn.execute(
                """
                INSERT INTO sources (source_id, agency_name, start_url, enabled)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(source_id) DO UPDATE SET
                    agency_name = excluded.agency_name,
                    start_url = excluded.start_url,
                    enabled = excluded.enabled
                """,
                (
                    source["source_id"],
                    source["agency_name"],
                    source["start_url"],
                    int(source["enabled"]),
                ),
            )
        conn.commit()


tab_properties, tab_sources = st.tabs(["Property results", "Scraper websites"])

with tab_sources:
    st.subheader("Scraper websites")
    st.markdown("Add, disable, edit, or remove websites used by the dynamic scraper.")

    sources_df = load_sources()
    edited_sources = st.data_editor(
        sources_df,
        key="sources_editor",
        num_rows="dynamic",
        hide_index=True,
        column_config={
            "source_id": st.column_config.NumberColumn("Source ID", min_value=1, step=1),
            "agency_name": st.column_config.TextColumn("Agency name", required=True),
            "start_url": st.column_config.LinkColumn("Start URL", required=True),
            "enabled": st.column_config.CheckboxColumn("Enabled", default=True),
        },
    )

    with st.container(horizontal=True):
        if st.button("Save websites", type="primary"):
            try:
                save_sources(edited_sources)
                load_sources.clear()
                load_data.clear()
                st.success("Websites saved. The next scraper run will use the updated list.")
                st.rerun()
            except ValueError as error:
                st.error(str(error))
        if st.button("Reload websites"):
            load_sources.clear()
            st.rerun()

    st.info("To remove a website, delete its row in the table and click Save websites.")

with tab_properties:
    df = load_data()

    if df.empty:
        st.warning("⚠️ No property records found in `properties.db` yet. Run your Scrapy spider to populate data!")
    else:
        st.sidebar.header("🔍 Filter Properties")
        agency_options = sorted(df["agency_name"].fillna(df["source_id"].astype(str)).unique())
        selected_agency = st.sidebar.multiselect("Select Agency", options=agency_options, default=agency_options)
        search_query = st.sidebar.text_input("Search title or content", "").strip().lower()

        agency_labels = df["agency_name"].fillna(df["source_id"].astype(str))
        filtered_df = df[agency_labels.isin(selected_agency)]
        if search_query:
            filtered_df = filtered_df[
                filtered_df["title"].fillna("").str.lower().str.contains(search_query, regex=False)
                | filtered_df["text_content"].fillna("").str.lower().str.contains(search_query, regex=False)
            ]

        with st.container(horizontal=True):
            st.metric("Total Properties Tracked", len(df), border=True)
            st.metric("Filtered View Count", len(filtered_df), border=True)
            st.metric("Active Sources", int(load_sources()["enabled"].sum()), border=True)

        st.divider()

        st.subheader("📋 Property Inventory List")
        display_columns = [
            column
            for column in ["agency_name", "title", "price", "match_score", "match_status", "url", "created_at"]
            if column in filtered_df.columns
        ]
        st.dataframe(
            filtered_df[display_columns],
            hide_index=True,
            column_config={"url": st.column_config.LinkColumn("URL")},
        )

        st.subheader("📈 Analytics & Insights")
        st.info("Tip: You can expand tables, sort columns, or search specific keywords using the tools above.")
