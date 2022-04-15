import {Inject, Injectable, NgModule} from '@angular/core';
import {Headers, HttpModule, Request, RequestMethod, Response, ResponseOptions, XHRBackend} from '@angular/http';
import * as testing from '@angular/http/testing';

/**
 * This interface describes a response to a specific connection. The connection
 * is identified by request method and URL.
 */
interface ConnectionResponse {
  method: RequestMethod;
  url: string;
  status?: number;
  body?: {};
  error?: Error;
  evaluateRequest?: EvaluateRequestFn<{}>;
  timesUsed: number;  // Indicates how often a response was returned.
}

interface VerificationResult {
  ok: boolean;
  /** Only present if ok is false */
  message?: string;
}

/**
 * Callback to evaluate the request once a connection was seen.
 */
// tslint:disable-next-line:no-any make tests easier to write.
export type EvaluateRequestFn<T = any> =
    (body: T, headers: Headers, request: Request) => void;

/**
 * This class can be used to mock backend responses. Simply call .when() for
 * each expected request and specify how the backend should behave.
 *
 * Example usage:
 *   backend.when(RequestMethod.Put, `/v1/books/1`)
 *    .evaluateRequest((body, headers) => {
 *      expect(body).toEqual(expectedRequest);
 *      expect(headers.get('If-match')).toEqual(token);
 *    })
 *    .respond(jsonResponse);
 */
@Injectable()
export class MockBackend {
  private responses: ConnectionResponse[] = [];
  private pendingConnections: testing.MockConnection[] = [];

  constructor(@Inject(XHRBackend) backend: testing.MockBackend) {
    backend.connections.subscribe((c: testing.MockConnection) => {
      this.handleConnection(c);
    });
  }

  /**
   * Defines how a request (identified by method and URL) is treated by the
   * mock backend,
   * @return A ResponseAction that can be used to specify a response or error.
   */
  when(method: RequestMethod, url: string): Action {
    if (this.findResponse(method, url)) {
      throw new Error(`Already defined a response for ${method} on ${url}`);
    }
    const resp = {method, url, timesUsed: 0};
    this.responses.push(resp);
    return new ResponseAction(resp);
  }

  /**
   * Checks that each connection has received a response. Should be called in
   * the afterEach() method of a test suite to fail incorrect tests.
   */
  verifyNoPendingRequests() {
    const result = this.internalVerifyNoPendingRequests();
    if (!result.ok) throw new Error(result.message);
  }

  private internalVerifyNoPendingRequests(): VerificationResult {
    if (!this.pendingConnections.length) return {ok: true};

    const summary =
        'No response could be found for the following connection(s):\n' +
        this.pendingConnections
            .map(c => `-) ${c.request.method} on ${c.request.url}`)
            .join('\n');

    return {
      ok: false,
      message: summary,
    };
  }

  /**
   * Checks that each response was used exactly once to resolve a connection.
   * Should be called in the afterEach() method of a test suite to fail
   * incorrect tests.
   */
  verifyEachResponseUsedOnce() {
    const result = this.internalVerifyEachResponseUsedOnce();
    if (!result.ok) throw new Error(result.message);
  }

  private internalVerifyEachResponseUsedOnce(): VerificationResult {
    let summary = '';

    const unused = this.responses.filter((r) => r.timesUsed === 0);
    if (unused.length) {
      summary += 'The following responses were not used:\n' +
          unused.map(r => `-) ${r.method} on ${r.url}`).join('\n');
    }

    const usedTooOften = this.responses.filter((r) => r.timesUsed > 1);
    if (usedTooOften.length) {
      summary += 'The following responses were used more than once:\n' +
          usedTooOften
              .map(r => `-) ${r.method} on ${r.url} fired ${r.timesUsed} times`)
              .join('\n');
    }

    const result: VerificationResult = {ok: summary.length === 0};
    if (!result.ok) result.message = summary;

    return result;
  }

  /**
   * Checks that each connection has received a response and that each response
   * was used exactly once to resolve a connection. Should be called in the
   * afterEach() method of a test suite to fail incorrect tests.
   *
   * Calling this method is preferred to calling both verifyNoPendingRequests()
   * and verifyEachResponseUsedOnce() separately since it can include messages
   * from both verifications at the same time.
   */
  verifyAllInteractions() {
    const nothingPending = this.internalVerifyNoPendingRequests();
    const usedOnce = this.internalVerifyEachResponseUsedOnce();
    if (!nothingPending.ok && !usedOnce.ok) {
      throw new Error(`${nothingPending.message}\n\n${usedOnce.message}`);
    }
    if (!nothingPending.ok) throw new Error(nothingPending.message);

    if (!usedOnce.ok) throw new Error(usedOnce.message);
  }

  /**
   * Checks all pending requests and fulfills any of them, if a response was
   * later registered for them.
   */
  resolveAllConnections() {
    const pending: testing.MockConnection[] = [...this.pendingConnections];
    // Clear so requests don't get added twice.
    this.pendingConnections = [];
    for (const con of pending) {
      this.handleConnection(con);
    }
  }

  /**
   * Clears responses and connections. Should be called in the afterEach()
   * method of a test suite to reset the backend for following tests.
   */
  resetExpectations() {
    this.responses = [];
    this.pendingConnections = [];
  }

  private findResponse(method: RequestMethod, url: string): ConnectionResponse
      |undefined {
    return this.responses.find((r) => r.method === method && r.url === url);
  }

  private handleConnection(con: testing.MockConnection) {
    const resp = this.findResponse(con.request.method, con.request.url);
    if (!resp) {
      // If no response is registered for a connection, we do not fail. Instead,
      // we save open requests. Users can call resolveAllConnections to try to
      // resolve pending requests at a later point in time.
      // verifyNoPendingRequests can be used to check that all requests received
      // a response.
      this.pendingConnections.push(con);
      return;
    }

    if (resp.evaluateRequest) {
      // TODO(b/131926196): Assert as a type, declared interface, or `unknown`.
      // tslint:disable:no-any no-unnecessary-type-assertion
      resp.evaluateRequest(
          (JSON.parse(con.request.getBody()) as any), con.request.headers,
          con.request);
      // tslint:enable:no-any no-unnecessary-type-assertion
    }

    resp.timesUsed++;
    if (resp.error) {
      con.mockError(resp.error);
      return;
    }
    con.mockRespond(new Response(
        new ResponseOptions({body: resp.body, status: resp.status})));
  }
}

/**
 * Defines a fluent interface for which action should be taken for a specific
 * connection.
 */
export interface Action {
  // tslint:disable-next-line:no-any make tests easier to write.
  evaluateRequest<T = any>(evaluateRequest: EvaluateRequestFn<T>): Action;
  status(status: number): Action;
  respond(body: {}): Action;
  error(error: Error): Action;
}

class ResponseAction implements Action {
  constructor(private readonly resp: ConnectionResponse) {}

  evaluateRequest<T>(evaluateRequest: EvaluateRequestFn<T>) {
    this.resp.evaluateRequest = evaluateRequest as EvaluateRequestFn<unknown>;
    return this;
  }

  status(status: number): Action {
    this.resp.status = status;
    return this;
  }

  respond(body: {}) {
    this.resp.body = body;
    this.resp.error = undefined;
    return this;
  }

  error(error: Error) {
    this.resp.error = error;
    this.resp.body = undefined;
    return this;
  }
}

/**
 * Module providing the MockBackend. Automatically registers the backend as
 * XHRBackend, so the HttpModule uses it for AJAX requests.
 */
@NgModule({
  imports: [HttpModule],
  providers: [
    MockBackend,
    {provide: XHRBackend, useClass: testing.MockBackend},
  ]
})
export class MockBackendModule {}
