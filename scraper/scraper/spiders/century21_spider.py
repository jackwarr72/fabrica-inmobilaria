import hashlib
import json
from pathlib import Path

import scrapy

class Century21Spider(scrapy.Spider):
    name = "century21_properties"

    def _configured_requests(self):
        sources_path = Path(__file__).resolve().parents[2] / "sources.json"
        with sources_path.open("r", encoding="utf-8") as source_file:
            sources = json.load(source_file)

        for source in sources:
            if source.get("enabled", True):
                yield scrapy.Request(
                    source["start_url"],
                    callback=self.parse,
                    meta={
                        "source_id": source["source_id"],
                        "agency_name": source["agency_name"],
                    },
                )

    async def start(self):
        for request in self._configured_requests():
            yield request

    def parse(self, response):
        source_id = response.meta["source_id"]
        agency_name = response.meta["agency_name"]

        for link in response.css('a[href*="/propiedad/"]'):
            url = response.urljoin(link.attrib["href"])
            title = link.attrib.get("title") or link.attrib.get("alt") or url.rsplit("/", 1)[-1]
            price = next((text.strip() for text in link.xpath(".//following::text()[contains(., '$')][1]").getall() if text.strip()), "N/A")

            yield {
                "source_id": source_id,
                "title": title.strip(),
                "url": url,
                "url_hash": hashlib.sha256(url.encode("utf-8")).hexdigest(),
                "text": f"{agency_name} Listing - Price: {price}",
                "engagement_metrics": {
                    "price": price,
                },
            }
