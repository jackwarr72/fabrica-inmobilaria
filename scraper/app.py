import sqlite3
import pandas as pd
import streamlit as st

# Configure the page layout
st.set_page_config(page_title="Fábrica Inmobiliaria Dashboard", layout="wide")

st.title("🏡 Fábrica Inmobiliaria: Property Intelligence")
st.markdown("Live property listings scraped directly from your local pipeline with interactive filtering.")

# Connect to SQLite and load data
@st.cache_data
def load_data():
    conn = sqlite3.connect("properties.db")
    df = pd.read_sql("SELECT title, price, url, text_content FROM properties", conn)
    conn.close()
    return df

df = load_data()

# --- SIDEBAR FILTERS ---
st.sidebar.header("🔍 Filter Properties")

# Text/Location Search Filter
search_query = st.sidebar.text_input("Search Location or Title", "").lower()

# Apply filters if data exists
if not df.empty:
    if search_query:
        # Filter rows where search query matches title or text content
        filtered_df = df[
            df['title'].str.lower().contains(search_query, na=False) | 
            df['text_content'].str.lower().contains(search_query, na=False)
        ]
    else:
        filtered_df = df
else:
    filtered_df = df

# --- MAIN DASHBOARD DISPLAY ---
col1, col2 = st.columns(2)
col1.metric("Total Properties Found", len(filtered_df))
col2.metric("Total Tracked in DB", len(df))

st.subheader("📋 Active Listings Inventory")

if not filtered_df.empty:
    # Display the interactive dataframe table
    st.dataframe(filtered_df, use_container_width=True)
else:
    st.warning("No properties match your search criteria.")