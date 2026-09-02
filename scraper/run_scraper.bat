@echo off
cd /d "C:\Users\Windows 11\Desktop\Project 1\scraper"
scrapy crawl dynamic_properties
py matcher.py
py sync_to_centinela.py
