const fs = require("fs");
const url = require("url");
const http = require("http");
const https = require("https");
const port = 3333;
const {apikey} = require("./auth/credentials.json");


const server = http.createServer();
server.on("request", request_handler);
server.listen(port);

function request_handler(req, res)
{
    console.log(`New Request from ${req.socket.remoteAddress} for ${req.url}`)
    if(req.url === "/" || req.url === "")
    {
        res.writeHead(200, {"Contect-Type": "text/html"});
        const htmlStream = fs.createReadStream("html/form.html");
        htmlStream.pipe(res);
    }
    else if (req.url.startsWith("/FindPrice"))
    {
        res.writeHead(200, {"Contect-Type": "text/html"});
        const {Currency, slug} = url.parse(req.url, true).query;
        //console.log({Currency, slug});
        //console.log(apikey);

       GetWhisky(Currency, slug, res);
    }
    else
    {
        res.writeHead(404,{"Contect-Type": "text/html"});
        res.end("<h1>404: File Not Found</h1>");
    }
}

function GetWhisky(Currency, slug, res)
{
    const host = "https://whiskyhunter.net/api/";
    const path = "auction_data/";
    const current = GetCurrentCurrency(slug);

    https.get(`${host}${path}${slug}/`, (token_stream) => process_stream(token_stream, parseJSON, current, Currency, res));

}
function process_stream (stream, callback , ...args)
{
	let body = "";
	stream.on("data", chunk => body += chunk);
	stream.on("end", () => callback(body, ...args));
}

function parseJSON(body, current, Currency, res)
{
    let fewAuctions = new Array();
    //Hand to lower the numberof auctions due to limited api usage
    for(let i=0; i<=2; i++)
    {
        fewAuctions[i] = {
            name : JSON.parse(body)[i].auction_name,
            date: JSON.parse(body)[i].dt,
            max: JSON.parse(body)[i].winning_bid_max,
            min: JSON.parse(body)[i].winning_bid_min,
            avg: JSON.parse(body)[i].winning_bid_mean
        }
    }
    //console.log(fewAuctions);
    //console.log("Print1: "+fewAuctions[0].min);
    changeCurrency(fewAuctions, current, Currency, res);
}

function GetCurrentCurrency(slug)
{
    let current = "";
    switch(slug)
    {
        case "catawiki":
        case "irish-whiskey-auctions":
            current = "EUR";
            break;
        case "global-whisky-auctions":
        case "just-whisky":
        case "mctears":
        case "rumauctioneer":
        case "scotchwhiskyauctions":
        case "speyside-whisky-auctions":
        case "thegrandwhiskyauction":
        case "the-whisky-shop-auctions":
            current = "GBP";
            break;
        case "unicorn-auctions":
            current = "USD";
            break;
        default:
            current = "GBP";
        
    }
    return current;
}

function changeCurrency(fewAuctions, current, Currency, res)
{
    const host = "https://api.currencyscoop.com/v1";
    const path = "/convert";
    const theKey = `?api_key=${apikey}`;

    const link = `${host}${path}${theKey}`;

    //console.log("Print2: "+fewAuctions[0].min);
    https.get(`${link}&from=${current}&to=${Currency}&amount=${fewAuctions[0].max}`,
       (token_stream) => process_stream(token_stream, looping1, fewAuctions, current, Currency, link, res));
}

function looping1(body, fewAuctions, current, Currency, link, res)
{
    fewAuctions[0].max = JSON.parse(body).response.value;
    //console.log("Print3: "+fewAuctions[0].min);
    //moveON(fewAuctions, Currency, res);
    https.get(`${link}&from=${current}&to=${Currency}&amount=${fewAuctions[0].min}`,
        (token_stream) => process_stream(token_stream, looping2, fewAuctions, current, Currency, link, res));
}

function looping2(body, fewAuctions, current, Currency, link, res)
{
    fewAuctions[0].min = JSON.parse(body).response.value;
    https.get(`${link}&from=${current}&to=${Currency}&amount=${fewAuctions[0].avg}`,
            (token_stream) => process_stream(token_stream, looping3, fewAuctions, current, Currency, link, res));
}

function looping3(body, fewAuctions, current, Currency, link, res)
{
    fewAuctions[0].avg = JSON.parse(body).response.value;
    moveON(fewAuctions, Currency, res);
}

function moveON(fewAuctions, Currency, res)
{
    i = 0;
    let html = `
    <h1>${fewAuctions[0].name}</h1>
    
    <h2>Date: ${fewAuctions[i].date}</h2>
            <ul>
                <li>Max Bid: ${Currency} ${fewAuctions[i].max}</li>
                <li>Min Bid: ${Currency} ${fewAuctions[i].mix}</li>
                <li>Avrage Bid: ${Currency} ${fewAuctions[i].avg}</li>
            </ul> 
    `;
    
    res.writeHead(200, {"Content-Type": "text/html"});
    res.end(html);
}