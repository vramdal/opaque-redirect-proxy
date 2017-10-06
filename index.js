
var proxy = require("http-proxy-simple").createProxyServer({ host: "0.0.0.0", port: process.env.PORT });

var url = require("url");

proxy.on("http-intercept-request", function (cid, request, response, remoteRequest, performRequest) {
    remoteRequest.url = process.env.TARGET;
    remoteRequest.headers.host = url.parse(process.env.TARGET).host;
    remoteRequest.followAllRedirects = true;
    performRequest(remoteRequest);
});

proxy.on("http-intercept-response", function (cid, request, response, remoteResponse, remoteResponseBody, performResponse) {
    performResponse(remoteResponse, remoteResponseBody);
});