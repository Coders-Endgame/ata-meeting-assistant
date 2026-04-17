import csv
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.tbmm.gov.tr"


def get_main_page():
    url = f"{BASE_URL}/Tutanaklar/DoneminTutanakMetinleri?Donem=28&YasamaYili=4"
    response = requests.get(url)
    return BeautifulSoup(response.text, "html.parser")


def get_all_sessions(soup):
    sessions = []

    # tüm birleşim linklerini bul
    links = soup.find_all("a", {"data-fancybox": "iframe"})

    for link in links:
        name = link.get_text(strip=True)  # "81 . Birleşim"
        href = urljoin(BASE_URL, link["href"])

        # aynı satırdaki özet linkini bul
        parent_tr = link.find_parent("tr")
        ozet_link_tag = parent_tr.find("a", string="Özet")

        ozet_url = None
        if ozet_link_tag:
            ozet_url = ozet_link_tag["href"]

        sessions.append({"name": name, "report_page": href, "ozet_url": ozet_url})

    return sessions


def get_html_report_link(report_page_url):
    response = requests.get(report_page_url)
    soup = BeautifulSoup(response.text, "html.parser")

    link = soup.find("a", {"title": "Html Dosyası"})
    if link:
        return link["href"]
    return None


def get_text_from_url(url):
    if not url:
        return ""

    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")

    return soup.get_text(separator="\n", strip=True)


def scrape_all():
    soup = get_main_page()
    sessions = get_all_sessions(soup)

    data = []

    for session in sessions:
        print(f"Processing: {session['name']}")

        # tam tutanak linki
        html_url = get_html_report_link(session["report_page"])

        full_text = get_text_from_url(html_url)
        summary_text = get_text_from_url(session["ozet_url"])

        data.append(
            {
                "session": session["name"],
                "full_text": full_text,
                "summary": summary_text,
            }
        )

    return data


def save_csv(data):
    with open("tutanaklar.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["session", "summary", "full_text"])
        writer.writeheader()

        for row in data:
            writer.writerow(row)


if __name__ == "__main__":
    data = scrape_all()
    save_csv(data)
