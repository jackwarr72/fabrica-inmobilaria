# This package will contain the spiders of your Scrapy project
#
# Please refer to the documentation for information on how to create and manage
# your spiders.
import scrapy
import hashlib

class KWPropertySpider(scrapy.Spider):
    name = "kw_properties"
    allowed_domains = ["kwmexico.mx"]
    start_urls = ["https://www.kwmexico.mx/Sections/Propiedades/"]

    def parse(self, response):
        # Locate property cards on the listing page (adjust CSS selectors based on target DOM structure)
        property_cards = response.css("div.property-card, .property-item") # Fallback general selector

        for card in property_cards:
            title = card.css("h2 a::text, .property-title::text").get()
            url = card.css("h2 a::attr(href), .property-title a::attr(href)").get()
            price = card.css(".property-price::text, .price::text").get()

            if url and title:
                # Ensure absolute URL
                if not url.startswith("http"):
                    url = response.urljoin(url)

                # Generate a unique URL hash for integrity tracking
                url_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()

                # Yield item to the APISyncPipeline
                yield {
                    "source_id": 1,  # Assumes Source id 1 is 'KW Mexico' in your database
                    "title": title.strip(),
                    "url": url,
                    "url_hash": url_hash,
                    "text": f"Listed Price: {price.strip() if price else 'N/A'}",
                    "engagement_metrics": {"price": price.strip() if price else None}
                }

        # Pagination handling (if applicable)
        next_page = response.css("a.next::attr(href), .pagination-next::attr(href)").get()
        if next_page:
            yield response.follow(next_page, callback=self.parse)