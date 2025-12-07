import json
import boto3
import urllib.request

def lambda_handler(event, context):
    # Get API key
    client = boto3.client('secretsmanager')
    secret = client.get_secret_value(SecretId='/api/key')
    api_key = json.loads(secret['SecretString'])['api_key']
    
    symbol = event.get('symbol', 'TSLA').upper()
    
    url = f"https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol={symbol}&apikey={api_key}&outputsize=compact"
    
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode())
    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
    
    # —— Handle ALL possible Alpha Vantage responses ——
    if "Error Message" in data:
        return {"statusCode": 400, "body": json.dumps({"error": f"Invalid symbol: {symbol}"})}
    
    if "Note" in data or "Information" in data:
        return {"statusCode": 429, "body": json.dumps({"error": "Alpha Vantage rate limit – wait 60 seconds or use a different key"})}
    
    if "Time Series (Daily)" not in data:
        return {"statusCode": 500, "body": json.dumps({"error": "Unexpected response", "raw": data})}
    
    # —— Success path ——
    time_series = data["Time Series (Daily)"]
    latest_date = sorted(time_series.keys())[0]
    latest = time_series[latest_date]
    
    result = {
        "symbol": symbol,
        "date": latest_date,
        "open": float(latest["1. open"]),
        "high": float(latest["2. high"]),
        "low": float(latest["3. low"]),
        "close": float(latest["4. close"]),
        "volume": int(latest["6. volume"])
    }
    
    # Save to S3
    s3 = boto3.client('s3')
    s3.put_object(
        Bucket="stock-agent-sriram",
        Key=f"{symbol}.json",
        Body=json.dumps(data)
    )
    
    return {"statusCode": 200, "body": json.dumps(result)}