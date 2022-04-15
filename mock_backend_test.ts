import {Http, HttpModule, RequestMethod, Response} from '@angular/common/http';
import {beforeEach, describe, expect, flush, get, it, MockBackend, MockBackendModule, setupModule} from './index';

const TEST_URL = '/v1/some-resource';
const TEST_URL_WITH_TYPO = '/v1/some_resource';
const TEST_RESOURCE = {
  name: 'resource-name'
};
const TEST_ERROR = 'severe_error';

describe('Mock backend', () => {
  let backend: MockBackend;
  let http: Http;

  beforeEach(() => {
    setupModule({imports: [MockBackendModule, HttpModule]});
    backend = get(MockBackend);
    http = get(Http);
  });

  it('fulfills a request when URL and method match', () => {
    backend.when(RequestMethod.Get, TEST_URL).respond(TEST_RESOURCE);

    let evaluatedResponse = false;
    http.get(TEST_URL).subscribe((resp: Response) => {
      expect(resp.json()).toEqual(TEST_RESOURCE);
      evaluatedResponse = true;
    });
    flush();

    // Will fail the test if their conditions are not met.
    backend.verifyNoPendingRequests();
    backend.verifyEachResponseUsedOnce();
    expect(evaluatedResponse).toBe(true);
  });

  it('propagates status', () => {
    backend.when(RequestMethod.Get, TEST_URL)
        .status(200)
        .respond(TEST_RESOURCE);

    let evaluatedResponse = false;
    http.get(TEST_URL).subscribe((resp: Response) => {
      expect(resp.status).toEqual(200);
      expect(resp.ok).toBe(true);
      evaluatedResponse = true;
    });
    flush();

    // Will fail the test if their conditions are not met.
    backend.verifyNoPendingRequests();
    backend.verifyEachResponseUsedOnce();
    expect(evaluatedResponse).toBe(true);
  });

  it('returns an error to a request when URL and method match', () => {
    backend.when(RequestMethod.Get, TEST_URL).error(new Error(TEST_ERROR));

    http.get(TEST_URL).subscribe(
        () => {
          fail('No response expected on this request.');
        },
        (err) => {
          expect(err.message).toContain(TEST_ERROR);
        });
    flush();

    // Will fail the test if their conditions are not met.
    backend.verifyNoPendingRequests();
    backend.verifyEachResponseUsedOnce();
  });

  it('only accepts one response for each URL/method pair', () => {
    const expectedError = new Error(
        `Already defined a response for ${RequestMethod.Get} on ${TEST_URL}`);
    backend.when(RequestMethod.Get, TEST_URL).respond({});
    expect(() => {
      backend.when(RequestMethod.Get, TEST_URL).respond({});
    }).toThrow(expectedError);
    // Registering a different URL doesn't interfere.
    backend.when(RequestMethod.Get, TEST_URL + '/v2').respond({});
  });

  it('accepts responses for the same URL but different methods', () => {
    backend.when(RequestMethod.Get, TEST_URL).respond({});
    backend.when(RequestMethod.Post, TEST_URL).respond({});
    http.get(TEST_URL);
    http.post(TEST_URL, {});
    flush();

    // Will fail the test if their conditions are not met.
    backend.verifyNoPendingRequests();
    backend.verifyEachResponseUsedOnce();
  });

  it('enables inspecting the request', () => {
    let evaluatedBody = false;
    backend.when(RequestMethod.Post, TEST_URL)
        .evaluateRequest((body) => {
          expect(body).toEqual(TEST_RESOURCE);
          evaluatedBody = true;  // To make sure this is really called.
        })
        .respond({});

    http.post(TEST_URL, TEST_RESOURCE);
    flush();

    expect(evaluatedBody).toBe(true);
  });

  describe('verifyNoPendingRequests', () => {
    it('fails a test if pending requests exist', () => {
      http.get(TEST_URL);
      flush();

      try {
        backend.verifyNoPendingRequests();
        fail('No exception raised by verifyNoPendingRequests');
      } catch (err: any) {
        expect(err.message).toContain('No response could be found for');
        expect(err.message).toContain(TEST_URL);
      }
    });
  });

  describe('verifyEachResponseUsedOnce', () => {
    it('fails a test if a response is not used', () => {
      backend.when(RequestMethod.Get, TEST_URL).respond(TEST_RESOURCE);

      try {
        backend.verifyEachResponseUsedOnce();
        fail('No exception raised by verifyEachResponseUsedOnce');
      } catch (err: any) {
        expect(err.message).toContain('The following responses were not used');
        expect(err.message).toContain(TEST_URL);
      }
    });

    it('fails a test if a response is used more than once', () => {
      backend.when(RequestMethod.Get, TEST_URL).respond(TEST_RESOURCE);
      http.get(TEST_URL);
      http.get(TEST_URL);
      flush();

      try {
        backend.verifyEachResponseUsedOnce();
        fail('No exception raised by verifyEachResponseUsedOnce');
      } catch (err: any) {
        expect(err.message)
            .toContain('The following responses were used more than once');
        expect(err.message).toContain(TEST_URL);
        expect(err.message).toContain('fired 2 time');
      }
    });
  });

  describe('verifyAllInteractions', () => {
    it('fails a test if pending requests exist' +
           ', like verifyNoPendingRequests does',
       () => {
         http.get(TEST_URL);
         flush();

         try {
           backend.verifyAllInteractions();
           fail('No exception raised by verifyAllInteractions');
         } catch (err: any) {
           expect(err.message).toContain('No response could be found for');
           expect(err.message).toContain(TEST_URL);
         }
       });

    it('fails a test if a response is not used' +
           ', like verifyEachResponseUsedOnce does',
       () => {
         backend.when(RequestMethod.Get, TEST_URL).respond(TEST_RESOURCE);

         try {
           backend.verifyAllInteractions();
           fail('No exception raised by verifyAllInteractions');
         } catch (err: any) {
           expect(err.message)
               .toContain('The following responses were not used');
           expect(err.message).toContain(TEST_URL);
         }
       });

    it('fails a test if a response is used more than once' +
           ', like verifyEachResponseUsedOnce does',
       () => {
         backend.when(RequestMethod.Get, TEST_URL).respond(TEST_RESOURCE);
         http.get(TEST_URL);
         http.get(TEST_URL);
         flush();

         try {
           backend.verifyAllInteractions();
           fail('No exception raised by verifyAllInteractions');
         } catch (err: any) {
           expect(err.message)
               .toContain('The following responses were used more than once');
           expect(err.message).toContain(TEST_URL);
           expect(err.message).toContain('fired 2 time');
         }
       });

    it('fails a test if pending requests exist and a response is not ' +
           'used, including messages for both',
       () => {
         backend.when(RequestMethod.Get, TEST_URL_WITH_TYPO)
             .respond(TEST_RESOURCE);
         http.get(TEST_URL);
         flush();

         try {
           backend.verifyAllInteractions();
           fail('No exception raised by verifyAllInteractions');
         } catch (err: any) {
           expect(err.message).toContain('No response could be found for');
           expect(err.message).toContain(TEST_URL);
           expect(err.message)
               .toContain('The following responses were not used');
           expect(err.message).toContain(TEST_URL_WITH_TYPO);
         }
       });

    it('fails a test if pending requests exist and a response is used ' +
           'more than once, including messages for both',
       () => {
         backend.when(RequestMethod.Get, TEST_URL).respond(TEST_RESOURCE);
         http.get(TEST_URL_WITH_TYPO);
         http.get(TEST_URL);
         http.get(TEST_URL);
         flush();

         try {
           backend.verifyAllInteractions();
           fail('No exception raised by verifyAllInteractions');
         } catch (err: any) {
           expect(err.message).toContain('No response could be found for');
           expect(err.message).toContain(TEST_URL_WITH_TYPO);
           expect(err.message)
               .toContain('The following responses were used more than once');
           expect(err.message).toContain(TEST_URL);
         }
       });
  });

  describe('resolveAllConnections', () => {
    it('resolves all pending connections', () => {
      let evaluatedResponse = false;
      http.get(TEST_URL).subscribe((resp: Response) => {
        expect(resp.json()).toEqual(TEST_RESOURCE);
        evaluatedResponse = true;
      });

      expect(() => {
        backend.verifyNoPendingRequests();
      }).toThrow();

      backend.when(RequestMethod.Get, TEST_URL).respond(TEST_RESOURCE);
      backend.resolveAllConnections();
      flush();

      // Will fail the test if their conditions are not met.
      backend.verifyNoPendingRequests();
      backend.verifyEachResponseUsedOnce();
      backend.verifyAllInteractions();
      expect(evaluatedResponse).toBe(true);
    });
  });

  describe('resetExpectations', () => {
    it('clears all responses and pending requests', () => {
      http.get(TEST_URL);
      backend.when(RequestMethod.Post, TEST_URL).respond(TEST_RESOURCE);

      // Both verify methods throw since there is a pending request, but the
      // response is also not used.
      expect(() => {
        backend.verifyNoPendingRequests();
      }).toThrow();
      expect(() => {
        backend.verifyEachResponseUsedOnce();
      }).toThrow();

      backend.resetExpectations();

      // Will fail the test if their conditions are not met.
      backend.verifyNoPendingRequests();
      backend.verifyEachResponseUsedOnce();
      backend.verifyAllInteractions();
    });
  });
});
