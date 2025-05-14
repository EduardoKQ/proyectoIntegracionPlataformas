import requests


class DolarService:
    endpoint = "https://cl.dolarapi.com/v1/cotizaciones/usd"
    health_check_endpoint = "https://cl.dolarapi.com/v1/estado"

    def __init__(self):
        """
        Initialize the DolarService class.
        """
        self.endpoint = self.endpoint
        self.health_check_endpoint = self.health_check_endpoint

    def api_not_available(self) -> bool:
        try:
            response = requests.get(url=self.health_check_endpoint)
            response.raise_for_status()
            if response.status_code == 200:
                return False
            return True
        except requests.RequestException:
            return True

    def get_dollar_exchange(self) -> dict | None:
        try:
            if self.api_not_available():
                return None
            response = requests.get(url=self.endpoint)
            response.raise_for_status()

            data = response.json()
            print(data)
            ask_price = float(data["venta"])
            date = data["fechaActualizacion"]

            return {
                "dollar_price": ask_price,
                "date": date,
            }

        except requests.RequestException as e:
            print(f"Error fetching data from API: {e}")
            return None

    def get_dollar_price(self, price, exchange_data) -> float | None:
        """
        Get the dollar price from the API.
        :return: The dollar price or None if the API is not available.
        """
        current_dollar_exchange = exchange_data["dollar_price"]
        if current_dollar_exchange is None:
            return None
        # Convert the price to dollars
        price_in_dollars = price / current_dollar_exchange
        # Round the price to 2 decimal places
        price_in_dollars = round(price_in_dollars, 2)
        return price_in_dollars

    def get_exchang_date(self, exchange_data) -> str | None:
        """
        Get the exchange rate from the API.
        :return: The exchange rate or None if the API is not available.
        """
        # get date
        date = exchange_data["date"]
        return date
