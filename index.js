import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext,
  useRef,
} from 'react';
import {formatURLArgs} from './utility';

// API Client

const JSON_MIME = 'application/json';

const defaultTransformer = (...args) => {
  if (args.length === 0) {
    return {
      params: null,
      query: null,
      body: null,
      headers: null,
      opts: null,
    };
  }
  if (args.length === 1) {
    return {
      params: null,
      query: null,
      body: args[0],
      headers: null,
      opts: null,
    };
  }
  const k = args.length - 1;
  return {
    params: args.slice(0, k),
    query: null,
    body: args[k],
    headers: null,
    opts: null,
  };
};

const defaultSelector = (_status, data) => {
  if (data) {
    return data;
  }
  return null;
};

const defaultErrHandler = (defaultMessage) => (_status, data) => {
  if (data) {
    return data;
  }
  return {
    message: defaultMessage,
  };
};

const defaultCatcher = (err) => err;

const makeFetch = ({
  url,
  method,
  transformer,
  expectdata,
  selector,
  err,
  catcher,
  headers: baseheaders,
  opts: baseopts,
}) => {
  const transformargs = transformer || defaultTransformer;
  const onsuccess = selector || defaultSelector;
  const onerr = (() => {
    if (!err) {
      return defaultErrHandler('Request error');
    }
    if (typeof err === 'string') {
      return defaultErrHandler(err);
    }
    return err;
  })();
  const oncatch = catcher || defaultCatcher;

  return async (...args) => {
    const req = transformargs(...args);

    const tempheaders = {};
    let body = undefined;
    if (req.body) {
      if (req.body instanceof FormData || req.body instanceof URLSearchParams) {
        body = req.body;
      } else {
        tempheaders['Content-Type'] = JSON_MIME;
        body = JSON.stringify(req.body);
      }
    }

    const headers = Object.assign(tempheaders, baseheaders, req.headers);
    const opts = Object.assign({}, baseopts, req.opts, {method, headers, body});
    const path = req.params ? formatURLArgs(url, req.params) : url;

    try {
      const u = new URL(path);
      if (req.query) {
        const q = u.searchParams;
        for (const [k, v] of Object.entries(req.query).sort((a, b) => {
          if (a < b) {
            return -1;
          }
          if (a > b) {
            return 1;
          }
          return 0;
        })) {
          q.set(k, v);
        }
      }
      const finalurl = u.toString();
      const res = await fetch(finalurl, opts);
      const status = res.status;
      if (status < 200 || status >= 300) {
        try {
          const err = await res.json();
          return [null, status, onerr(status, err)];
        } catch (_err) {
          return [null, status, onerr(status)];
        }
      }
      if (!expectdata) {
        return [onsuccess(status), status, null];
      }
      const data = await res.json();
      return [onsuccess(status, data), status, null];
    } catch (err) {
      return [null, -1, oncatch(err)];
    }
  };
};

const makeAPIClient = (baseurl, baseopts, apiconfig) => {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(apiconfig).map(([k, v]) => {
        const url = baseurl + v.url;
        const fn = v.method
          ? makeFetch(
              Object.assign({opts: baseopts}, v, {url, children: undefined}),
            )
          : {};
        if (v.children) {
          Object.assign(fn, makeAPIClient(url, baseopts, v.children));
        }
        Object.assign(fn, {
          prop: {
            url,
            formatUrl: (args) => formatURLArgs(url, args),
          },
        });
        return [k, Object.freeze(fn)];
      }),
    ),
  );
};

// Hooks

const APIContext = createContext();

const APIMiddleware = (value) => ({
  ctxProvider: ({children}) => (
    <APIContext.Provider value={value}>{children}</APIContext.Provider>
  ),
});

const useAPI = (selector) => {
  const apiClient = useContext(APIContext);
  return selector(apiClient);
};

const useURL = (selector, args = []) => useAPI(selector).prop.formatUrl(args);

const API_CANCEL = Symbol('API_CANCEL');

const useAPICall = (
  selector,
  args = [],
  initState,
  {prehook, posthook, errhook} = {},
) => {
  const [apiState, setApiState] = useState({
    loading: false,
    success: false,
    err: null,
    status: -1,
    data: initState,
  });
  const route = useAPI(selector);
  const initStateRef = useRef(initState);
  initStateRef.current = initState;
  const argsRef = useRef(args);
  argsRef.current = args;

  const apicall = useCallback(
    async ({cancelRef} = {}) => {
      setApiState((s) =>
        Object.assign({}, s, {
          loading: true,
        }),
      );

      if (prehook) {
        const err = await prehook(argsRef.current, {cancelRef});
        if (cancelRef && cancelRef.current) {
          return [null, -1, API_CANCEL];
        }
        if (err) {
          setApiState({
            loading: false,
            success: false,
            err,
            status: -1,
            data: initStateRef.current,
          });
          if (errhook) {
            errhook('prehook', err);
          }
          return [null, -1, err];
        }
      }

      const [data, status, err] = await route(...argsRef.current);
      if (cancelRef && cancelRef.current) {
        return [null, -1, API_CANCEL];
      }
      if (err) {
        setApiState({
          loading: false,
          success: false,
          err,
          status,
          data: initStateRef.current,
        });
        if (errhook) {
          errhook('api', err);
        }
        return [data, status, err];
      }

      if (posthook) {
        posthook(status, data, {cancelRef});
      }

      setApiState({
        loading: false,
        success: true,
        err: null,
        status,
        data,
      });
      return [data, status, null];
    },
    [setApiState, argsRef, initStateRef, route, prehook, posthook, errhook],
  );

  return [apiState, apicall];
};

const selectAPINull = () => null;

const useResource = (selector, args = [], initState, opts) => {
  const [apiState, execute] = useAPICall(selector, args, initState, opts);

  useEffect(() => {
    const cancelRef = {current: false};
    if (selector !== selectAPINull) {
      execute({cancelRef});
    }
    return () => {
      cancelRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, execute, ...args]);

  const reexecute = useCallback(
    (opts) => {
      if (selector !== selectAPINull) {
        execute(opts);
      }
    },
    [selector, execute],
  );

  return [apiState, reexecute];
};

export {
  makeFetch,
  makeAPIClient,
  APIContext,
  APIMiddleware,
  useAPI,
  useURL,
  useAPICall,
  API_CANCEL,
  useResource,
  selectAPINull,
};
