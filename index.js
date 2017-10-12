
//var proxy = require("http-proxy-simple").createProxyServer({ host: "0.0.0.0", port: process.env.PORT });

var url = require("url");
var events = require("events");

let serverName = process.env.SERVER_NAME;

let proxyserver = new events.EventEmitter();

/*  helper function: emit event or run fallback action  */
let emitOrRun = function (eventName, callback) {
    if (!proxyserver.listeners(eventName).length)
        callback();
    else {
        let args = Array.prototype.slice.call(arguments, 2);
        args.unshift(eventName);
        proxyserver.emit.apply(proxyserver, args);
    }
};

exports.redirectGoogleAppsCall = function helloGET (request, response) {

    /*  determine connection id  */
    let cid = request.connection.remoteAddress + ":" + request.connection.remotePort;

    /*  for interception ensure there is no compression  */
    request.headers["accept-encoding"] = "identity";
    delete request.headers["proxy-connection"];

    /*  provide forwarding information (1/2)  */
    let clientIp = request.connection.remoteAddress;
    if (request.headers["x-forwarded-for"])
        request.headers["x-forwarded-for"] += ", " + clientIp;
    else
        request.headers["x-forwarded-for"] = clientIp;
    request.headers["forwarded-for"] = request.headers["x-forwarded-for"];

    /*  provide forwarding information (2/2)  */
    //request.headers.via = request.httpVersion + " " + serverName;
    let localAddr = request.connection.address();
    if (localAddr !== null)
        request.headers.via += ":" + request.connection.address().port;
    //request.headers.via += " (" + id + ")";

    /*  assemble request information  */
    let remoteRequest = {
        url:            request.url,
        method:         request.method,
        headers:        request.headers,
        body:           request.body,
        followRedirect: false,
        encoding:       null
    };
/*
    if (proxy !== "") {
        let hostname = url.parse(remoteRequest.url).hostname;
        if (hostname !== "localhost" && hostname !== "127.0.0.1")
            remoteRequest.proxy = proxy;
    }
*/

    /*  helper function for fixing the upper/lower cases of headers  */
    let fixHeaderCase = function (headers) {
        let result = {};
        for (let key in headers) {
            if (!headers.hasOwnProperty(key))
                continue;
            let newKey = key.split("-")
                .map(function(token) { return token[0].toUpperCase() + token.slice(1); })
                .join("-");
            result[newKey] = headers[key];
        }
        return result;
    };

    /*  perform the HTTP client request  */
    let performRequest = function (remoteRequest) {
        /*  adjust headers  */
        remoteRequest.headers = fixHeaderCase(remoteRequest.headers);
        try {
            req(remoteRequest, function (error, remoteResponse, remoteResponseBody) {
                /*  perform the HTTP client response  */
                if (error) {
                    proxyserver.emit("http-error", cid, error, request, response);
                    response.writeHead(400, {});
                    response.end();
                }
                else {
                    let performResponse = function (remoteResponse, remoteResponseBody) {
                        response.writeHead(remoteResponse.statusCode, remoteResponse.headers);
                        response.write(remoteResponseBody);
                        response.end();
                    };
                    emitOrRun("http-intercept-response", function () {
                        performResponse(remoteResponse, remoteResponseBody);
                    }, cid, request, response, remoteResponse, remoteResponseBody, performResponse);
                }
            });
        }
        catch (error) {
            proxyserver.emit("http-error", cid, error, request, response);
            response.writeHead(400, {});
            response.end();
        }
    };
    let body = "";
    request.on('data', function (chunk) {
        body += chunk;
    });

    request.on('end', function () {
        remoteRequest.body = request.body = body;
        emitOrRun("http-intercept-request", function () {
            performRequest(remoteRequest);
        }, cid, request, response, remoteRequest, performRequest);
    });


};


/*

proxy.on("http-intercept-request", function (cid, request, response, remoteRequest, performRequest) {
    remoteRequest.url = process.env.TARGET;
    remoteRequest.headers.host = url.parse(process.env.TARGET).host;
    remoteRequest.followAllRedirects = true;
    performRequest(remoteRequest);
});

proxy.on("http-intercept-response", function (cid, request, response, remoteResponse, remoteResponseBody, performResponse) {
    performResponse(remoteResponse, remoteResponseBody);
});
*/
