import json
import hashlib
from pathlib import Path

import scrapy

class DynamicPropertySpider(scrapy.Spider):
    name = "dynamic_properties"

    def _configured_requests(self):
        sources_path = Path(__file__).resolve().parents[2] / "sources.json"
        with sources_path.open("r", encoding="utf-8") as source_file:
            sources = json.load(source_file)

        for source in sources:
            if source.get("enabled", True):
                meta = {
                    "source_id": source["source_id"],
                    "agency_name": source["agency_name"],
                }
                callback = self.parse_kw if "kwmexico.mx" in source["start_url"] else self.parse
                yield scrapy.Request(
                    source["start_url"],
                    callback=callback,
                    meta=meta,
                )

    async def start(self):
        for request in self._configured_requests():
            yield request

    def parse(self, response):
        agency_name = response.meta["agency_name"]
        self.logger.info(f"✅ Successfully downloaded page for {agency_name}!")

        if "century21mexico.com" in response.url:
            listings = response.css(
                'a[href*="/propiedad/"], .carousel-item, .property-card, '
                '.inmobiliaria-item, .resultado-item, article'
            )
        else:
            listings = response.css(
                ".property-card, .property-item, .inmobiliaria-item, "
                ".resultado-item, .listing-card, article, div[role='article']"
            )

        self.logger.info(f"📋 Found {len(listings)} listings on the page.")

        for listing in listings:
            url = listing.css('::attr(href)').get() or listing.css('a::attr(href)').get()
            if not url:
                continue

            url = response.urljoin(url)
            title = (
                listing.css('::attr(title)').get()
                or listing.css('::attr(aria-label)').get()
                or listing.css('.title::text, .property-title::text, .card-title::text, h2::text, h3::text').get()
                or "N/A"
            ).strip()
            price = (
                listing.css('.price::text, .precio::text, .property-price::text, .amount::text, span.amount::text').get()
                or next(
                    (text.strip() for text in listing.xpath('.//text()[contains(., "$") or contains(., "MXN")]').getall() if text.strip()),
                    "N/A",
                )
            ).strip()

            yield {
                "source_id": response.meta["source_id"],
                "title": title,
                "url": url,
                "url_hash": hashlib.sha256(url.encode("utf-8")).hexdigest(),
                "text": f"{agency_name} Listing - Price: {price}",
                "engagement_metrics": {"price": price},
            }

    def parse_kw(self, response):
        api_url = (
            "https://cuj9iqvhg9.execute-api.us-east-2.amazonaws.com/Produccion/"
            "Properties_API/Listed_Properties_Info?Properties_Listing_Init=0"
        )
        yield scrapy.Request(
            api_url,
            callback=self.parse_kw_api,
            meta=response.meta,
        )

    def parse_kw_api(self, response):
        payload = json.loads(response.text)
        properties = payload.get("data", {}).get("Properties_Data", [])
        self.logger.info("📋 Found %s KW Mexico properties.", len(properties))

        for property_data in properties:
            property_id = property_data.get("ID")
            if not property_id:
                continue

            url = f"https://www.kwmexico.mx/Sections/Propiedades/?property_id={property_id}"
            price = property_data.get("Current_Price")
            currency = property_data.get("Currency") or "MXN"
            clean_price = f"${price:,.0f} {currency}" if isinstance(price, (int, float)) else "N/A"
            location = ", ".join(
                value for value in (
                    property_data.get("State"),
                    property_data.get("City"),
                    property_data.get("Colony"),
                    property_data.get("Postal_Code"),
                ) if value
            )

            yield {
                "source_id": response.meta["source_id"],
                "title": property_data.get("Title") or f"KW Mexico Property {property_id}",
                "url": url,
                "url_hash": hashlib.sha256(url.encode("utf-8")).hexdigest(),
                "text": property_data.get("Description") or f"KW Mexico Listing - {location} - Price: {clean_price}",
                "engagement_metrics": {
                    "price": clean_price,
                    "location": location,
                    "bedrooms": property_data.get("Total_Bed"),
                    "bathrooms": property_data.get("Total_Bath"),
                    "construction_area_m2": property_data.get("Living_Area"),
                    "property_id": property_id,
                },
            }