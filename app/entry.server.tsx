import { PassThrough } from "node:stream";

import type { AppLoadContext, EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";

const ABORT_DELAY = 5_000;

export default function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    routerContext: EntryContext,
    loadContext: AppLoadContext
) {
    return new Promise((resolve, reject) => {
        let shellRendered = false;
        const userAgent = request.headers.get("user-agent");

        // Ensure requests from bots are not streamed
        const readyMethod =
            (userAgent && isbot(userAgent)) || routerContext.isSpaMode
                ? "onAllReady"
                : "onShellReady";

        const { pipe, abort } = renderToPipeableStream(
            <ServerRouter
                context={routerContext}
                url={request.url}
                abortDelay={ABORT_DELAY}
            />,
            {
                [readyMethod]() {
                    shellRendered = true;
                    const body = new PassThrough();
                    const stream = createReadableStreamFromReadable(body);

                    responseHeaders.set("Content-Type", "text/html");

                    resolve(
                        new Response(stream, {
                            headers: responseHeaders,
                            status: responseStatusCode,
                        })
                    );

                    pipe(body);
                },
                onShellError(error: unknown) {
                    reject(error);
                },
                onError(error: unknown) {
                    responseStatusCode = 500;
                    // Log streaming errors in-flight
                    if (shellRendered) {
                        console.error(error);
                    }
                },
            }
        );

        setTimeout(abort, ABORT_DELAY);
    });
}
