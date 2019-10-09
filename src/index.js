import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useRef,
} from 'react';
import {formatStrArgs} from './utility';

// API Client

const JSON_MIME = 'application/json';

const defaultTransformer = (...args) => {
  if (args.length === 0) {
    return [null, null, null, null];
  }
  if (args.length === 1) {
    return [null, args[0], null, null];
  }
  const k = args.length - 1;
  return [args.slice(0, k), args[k], null, null];
};

const defaultSelector = (_status, data) => {
  if (data) {
    return data;
  }
  return null;
};

const defaultErrHandler = (defaultMessage) => (_status, data) => {
  if (data && data.message) {
    return data.message;
  }
  return defaultMessage;
};

const defaultCatcher = (err) => err.message;

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
    const [params, bodycontent, reqheaders, reqopts] = transformargs(...args);

    const tempheaders = {};
    let body = undefined;
    if (bodycontent) {
      if (bodycontent instanceof FormData) {
        body = bodycontent;
      } else {
        tempheaders['Content-Type'] = JSON_MIME;
        body = JSON.stringify(bodycontent);
      }
    }

    const headers = Object.assign(tempheaders, baseheaders, reqheaders);
    const opts = Object.assign({}, baseopts, reqopts, {method, headers, body});
    const finalurl = params ? formatStrArgs(url, params) : url;

    try {
      const res = await fetch(finalurl, opts);
      const status = res.status;
      if (status < 200 || status >= 300) {
        const err = await res.json();
        return [null, status, onerr(status, err)];
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
          api_prop: {
            url,
            formatUrl: (args) => formatStrArgs(url, args),
          },
        });
        return [k, Object.freeze(fn)];
      }),
    ),
  );
};

// Hooks

const APIContext = React.createContext();

const useAPI = (selector) => {
  const apiClient = useContext(APIContext);
  return selector(apiClient);
};

const useURL = (selector, args = []) =>
  useAPI(selector).api_prop.formatUrl(args);

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
        const err = await posthook(status, data, {cancelRef});
        if (cancelRef && cancelRef.current) {
          return [null, -1, API_CANCEL];
        }
        if (err) {
          setApiState({
            loading: false,
            success: false,
            err,
            status,
            data,
          });
          if (errhook) {
            errhook('posthook', err);
          }
          return [data, status, err];
        }
      }

      setApiState({
        loading: false,
        success: true,
        err: null,
        status,
        data,
      });
      return [data, status, err];
    },
    [setApiState, argsRef, initStateRef, route, prehook, posthook, errhook],
  );

  return [apiState, apicall];
};

const selectAPINull = () => null;

const useResource = (selector, args = [], initState, opts) => {
  const [apiState, execute] = useAPICall(selector, args, initState, opts);

  useEffect(() => {
    let cancelRef = {current: false};
    if (selector !== selectAPINull) {
      execute({cancelRef});
    }
    return () => {
      cancelRef.current = true;
    };
  }, [selector, execute]);

  const reexecute = useCallback(
    (opts) => {
      if (selector !== selectAPINull) {
        execute(opts);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selector, execute, ...args],
  );

  return {...apiState, reexecute};
};

export {
  makeFetch,
  makeAPIClient,
  APIContext,
  useAPI,
  useURL,
  useAPICall,
  API_CANCEL,
  useResource,
  selectAPINull,
};
