# substation
a client data framework to power reactive apps

## Introduction

`substation` is a library that provides a declarative way to build web API
clients. It currently only supports HTTP rest APIs.

#### Design Goals

HTTP servers are often built in the form of a "middleware router tree", where a
request is passed from router to router each matching a prefix of the path.
For example, given a path such as `/api/user/xorkevin`, one router may be
responsible for matching `/api`, sending the request to another router. That
router then matches `/user`, sending it to a final route handler which handles
the entire route. This design has worked well for HTTP servers. Unfortunately,
there is no comparable client side library that uses this pattern.

`substation` aims to be the client side library that addresses this. It models
an HTTP API client as a tree of handlers based on the url path. It also
provides React hooks that provide an opionated and declarative way to call HTTP
rest APIs.

## Installation

1. This package is currently released on Github's npm package registry. Follow
   [Configuring npm for use with Github package
   registry](https://help.github.com/en/articles/configuring-npm-for-use-with-github-package-registry#installing-a-package)
   to authenticate with Github.

2. Add the following line to `.npmrc` at the root of your project.

  `.npmrc`:

  ```
  @xorkevin:registry=https://npm.pkg.github.com
  ```

3. Run:

  ```
  $ npm install -S @xorkevin/substation
  ```

## Usage

`substation` has two modules: The first is a core declarative API client
builder in the form of `makeAPIClient`. The second is a library of React hooks,
such as `useAPICall` and `useResource` which allow the API client to be used in
a declarative manner by React components. The former can be used independently
of the latter.

### `makeAPIClient`

`makeAPIClient` takes in a declarative API configuration and creates an API
client as defined in the `APIClient` section. Conceptually, it treats an HTTP
rest API as a tree of routes and methods.

#### Example

```js
import {makeAPIClient} from '@xorkevin/substation';

const apiConfig = {
  healthz: {
    url: '/healthz',
    children: {
      check: {
        url: '/report',
        method: 'GET',
        expectdata: true,
        err: 'Could not get health report from api server',
      },
    },
  },
  u: {
    url: '/u',
    children: {
      user: {
        url: '/user',
        children: userAPI,
      },
      auth: {
        url: '/auth',
        children: authAPI,
      },
    },
  },
  profile: {
    url: '/profile',
    children: profileAPI,
  },
};

const baseOpts = Object.freeze({
  credentials: 'include',
});

const baseUrl = '/api';

const APIClient = makeAPIClient(baseUrl, baseOpts, apiConfig);
```

This api client may then be used directly. For example:

```js
// calls HTTP GET /api/healthz/report
const [data, status, err] = await APIClient.healthz.check();
```

However, when using React hooks, it is recommended to use the provided hooks
instead.

### `makeAPIClient` Configuration

`makeAPIClient(baseUrl, baseOpts, apiConfig) -> APIClient`

#### `baseUrl`

Type: `string`

`baseUrl` is the base url which defines the root of an HTTP API.

##### Example

```js
const apiConfig = {
  hello: {
    url: '/hello',
    method: 'GET',
  },
};

const baseURL = '/api';

// APIClient consists of a function hello which makes a request to /api/hello
const APIClient = makeAPIClient(baseURL, {}, apiConfig);
await APIClient.hello();

const baseURL2 = '/api/v2';

// APIClient consists of a function hello which makes a request to /api/v2/hello
const APIClient2 = makeAPIClient(baseURL, {}, apiConfig);
await APIClient2.hello();
```

#### `baseOpts`

Type: `Object`

`baseOpts` provides default values that are passed to the web [Fetch
API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). These values
are specified in the `init` section of the [fetch
documentation](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch).
`baseOpts` are set for all functions of an APIClient. They may be overridden on
a per function and per call basis as described in the `apiConfig` section.

#### `apiConfig`

Type: `Object`

`apiConfig` is a plain JS object that has keys with the name of the current
route, and values of a `routeConfig` as defined in the next section.

##### Example

```js
const apiConfig = {
  hello: { /* routeConfig */ },
  world: { /* routeConfig */ },
};

// APIClient has functions hello and world as defined in the apiConfig
const APIClient = makeAPIClient('/api', {}, apiConfig);
await APIClient.hello();
await APIClient.world();
```

#### `routeConfig`

Type: `Object`

`routeConfig` is a plain JS object with the following fields that configure a
route.

```js
{
  url: 'string, required',
  method: 'string, optional',
  transformer: 'Function(), optional',
  expectdata: 'boolean, optional',
  selector: 'Function(), optional',
  err: 'Function() | string, optional',
  catcher: 'Function(), optional',
  headers: 'Object, optional',
  opts: 'Object, optional',
  children: 'apiConfig, optional',
}
```

#### `url`

Type: `string`, required

`url` defines a path for the current route relative to its parent.

A `url` may also have arguments defined by the placeholders `{0}`, `{1}`,
`{2}`, ... These are each replaced by their respective `n`th argument provided
to the route through the transformer which is defined in the `transformer`
section.

##### Example

```js
const apiConfig = {
  hello: {
    url: '/ping',
    method: 'GET',
    children: {
      user: {
        url: '/{0}',
        method: 'GET',
        transformer: (username) => [[username], null],
      },
    },
  },
};

// APIClient has two functions available: hello and hello.user
const APIClient = makeAPIClient('/api', {}, apiConfig);

// calls HTTP GET /api/ping
await APIClient.hello();

// calls HTTP GET /api/ping/xorkevin
await APIClient.hello.user('xorkevin');
```

#### `method`

Type: `string`, optional

`method` defines the method of the HTTP request, and may be one of the defined
[HTTP methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods).

If no method is provided, then no route function is generated for the current
path. Though functions will still be generated for all children with a
`routeConfig` defined with a `method`. There are two reasons for this behavior.
First, some APIs may not have an HTTP handler defined for every prefix of a
path. Second, one may want to define a url for a path without defining an http
client fetch for it, e.g. using the url for an image src.

##### Example

```js
const apiConfig = {
  profile: {
    url: '/profile',
    children: {
      user: {
        url: '/{0}',
        method: 'GET',
        transformer: (username) => [[username], null],
        children: {
          image: {
            url: '/image',
          },
        },
      },
    },
  },
};

// APIClient has one function available: profile.user
const APIClient = makeAPIClient('/api', {}, apiConfig);

// will fail because profile has no method defined
// await APIClient.profile();

// calls HTTP GET /api/profile/xorkevin
await APIClient.profile.user('xorkevin');

// can now render <img src={APIClient.profile.user.image.prop.formatUrl('xorkevin')} />
// produces url /api/profile/xorkevin/image
```

#### `transformer`

Type: `Function(...args) -> [urlParams: string[] | null, body: Object | FormData | null, headers: Object | null, opts: Object | null]`, optional

`transformer` is called on all the arguments passed to a route, and it returns
a 4 element array (tuple) containing the url params array, request body,
request headers, and request opts. The `n`th element in the url params array
corresponds to the `n`th `{n}` placeholder as seen in the `url` field
definition. The body may be a JSON object or
[FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData). The
`Content-Type` header will be set automatically in both cases. Headers and opts
override any default headers and opts that were set by `baseOpts` prior. Any
element of the tuple is nullable.

##### Example

```js
const apiConfig = {
  user: {
    url: '/user',
    children: {
      name: {
        url: '/{0}',
        update: {
          url: '',
          method: 'PUT',
          transformer: (username, fields) => [[username], fields],
        },
      },
    },
  },
};

const APIClient = makeAPIClient('/api', {}, apiConfig);

// calls HTTP PUT /api/user/xorkevin with the JSON string body of '{ "firstName": "Kevin" }'
await APIClient.user.name.update('xorkevin', { firstName: 'Kevin' });
```

##### Default Transformer

The default transformer is defined as:

```js
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
```

#### `expectdata`

Type: `boolean`, optional

When `expectdata` is `true`, a JSON response is expected, and will attempt to
be parsed. When false, no response is expected.

```js
const apiConfig = {
  user: {
    url: '/user',
    children: {
      name: {
        url: '/{0}',
        method: 'GET',
        transformer: (username) => [[username], null],
        expectdata: true,
      },
    },
  },
};

const APIClient = makeAPIClient('/api', {}, apiConfig);

// calls HTTP GET /api/user/xorkevin
const [data, status, err] = await APIClient.user.name('xorkevin');
// an example response might be:
// data: { firstName: 'Kevin' }
// status: 200
// err: null
```

#### `selector`

Type: `Function(status: int, data: Object | undefined) -> Object`, optional

`selector` is a function taking in an HTTP response status, and any data in the
response body if `expectdata` was true. It is called only when a response is
received from the server with an HTTP status in the range of `2XX`.

##### Example

```js
const apiConfig = {
  user: {
    url: '/user',
    children: {
      name: {
        url: '/{0}',
        method: 'GET',
        transformer: (username) => [[username], null],
        expectdata: true,
        selector: (_status, {firstName}) => firstName,
      },
    },
  },
};

const APIClient = makeAPIClient('/api', {}, apiConfig);

// calls HTTP GET /api/user/xorkevin
const [data, status, err] = await APIClient.user.name('xorkevin');
// if the HTTP response were 200 OK '{ "firstName": "Kevin" }'
// then the returned values would be
// data: 'Kevin'
// status: 200
// err: null
```

##### Default Selector

The default selector is defined as:

```js
const defaultSelector = (_status, data) => {
  if (data) {
    return data;
  }
  return null;
};
```

#### `err`

Type: `Function(status: int, err: Object | undefined) -> Object | string`, optional

`err` is a function taking in an HTTP response status, and any data in the
response body if a there was a body present. It is called only when a response
is received from the server with an HTTP status **outside** the range of `2XX`.

As a convenience, `err` may also be a string of which a default error handler
will be created for that will always return that message when called.

##### Example

```js
const apiConfig = {
  user: {
    url: '/user',
    children: {
      name: {
        url: '/{0}',
        method: 'GET',
        transformer: (username) => [[username], null],
        err: (_status, data) => data && data.message,
      },
    },
  },
};

const APIClient = makeAPIClient('/api', {}, apiConfig);

// calls HTTP GET /api/user/xorkevin
const [data, status, err] = await APIClient.user.name('xorkevin');
// if the HTTP response were 404 Not Found '{ "message": "user with username does not exist" }'
// then the returned values would be
// data: null
// status: 404
// err: 'user with username does not exist'
```

##### Default Err Handler

The default err handler is defined as:

```js
const errHandler = (defaultMessage) => (_status, data) => {
  if (data && data.message) {
    return data.message;
  }
  return defaultMessage;
};

const defaultErrHandler = errHandler('Request error');
```

#### `catcher`

Type: `Function(Error) -> Object`, optional

`catcher` is a function taking in a JS
[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)
and returning some Object. `catcher` is called whenever there is an error
thrown by the underlying `fetch` HTTP call. In such a situation, the route will
return a status of `-1`.

##### Example

```js
const apiConfig = {
  user: {
    url: '/user',
    children: {
      name: {
        url: '/{0}',
        method: 'GET',
        transformer: (username) => [[username], null],
        catcher: (err) => err.message,
      },
    },
  },
};

const APIClient = makeAPIClient('/api', {}, apiConfig);

// calls HTTP GET /api/user/xorkevin
const [data, status, err] = await APIClient.user.name('xorkevin');
// if a connection could not be established with the server
// then the returned values could be
// data: null
// status: -1
// err: 'NetworkError when attempting to fetch resource'
```

##### Default Catcher

The default catcher is defined as:

```js
const defaultCatcher = (err) => err.message;
```

#### `headers`

Type: `Object`, optional

`headers` are default headers for the current route. Each key is the name of an
HTTP header, and their value is their corresponding header value. Default
header values set by `headers` will override **all** headers provided in
`baseOpts`. Again, these header values can be overridden by those returned by
the `selector`.

Note: As explained in the `transformer` section, there is no need to set the
`Content-Type` to `application/json` or another specific MIME when dealing with
JSON and FormData. That is automatically handled.

#### `opts`

Type: `Object`, optional

`opts` are default opts for the current route. Like `baseOpts`, `opts` provides
default values that are passed to the web [Fetch
API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) except they
are only applied to the current route. These values are specified in the `init`
section of the [fetch
documentation](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch).
`opts` will override any defaults set by `baseOpts` for the current route. The
only `opts` that will be ignored will be `method`, `headers`, and `body`, as
those are set by their corresponding fields in the `routeConfig`.

#### `children`

Type: `apiConfig`, optional

`children` defines a subtree of routes rooted at the current path. `url`s along
this path are added together to form the final url path.

##### Example

```js
const apiConfig = {
  hello: {
    url: '/ping',
    method: 'GET',
    children: {
      user: {
        url: '/{0}',
        method: 'GET',
        transformer: (username) => [[username], null],
      },
    },
  },
};

// APIClient has two functions available: hello and hello.user
const APIClient = makeAPIClient('/api', {}, apiConfig);

// calls HTTP GET /api/ping
await APIClient.hello();

// calls HTTP GET /api/ping/xorkevin
await APIClient.hello.user('xorkevin');
```

### `APIClient`

An `APIClient` is returned by `makeAPIClient` which is a tree of JS objects and
async functions that return `[data, status, err]: [Object, int, string]` known
as `route`s. `data` is the json response sent back by the server, if any.
`status` is the HTTP status code sent back by the server. `-1` is returned if
the HTTP request failed to be made, e.g. failing to establish a TCP connection.
`err` is a string of the error or `null` if there is none.

##### Example

```js
const apiConfig = {
  hello: {
    url: '/ping',
    method: 'GET',
    children: {
      user: {
        url: '/{0}',
        method: 'GET',
        transformer: (username) => [[username], null],
      },
    },
  },
};

// APIClient has two functions available: hello and hello.user
const APIClient = makeAPIClient('/api', {}, apiConfig);

// calls HTTP GET /api/ping/xorkevin
const [data, status, err] = await APIClient.hello.user('xorkevin');
// if the HTTP response were 200 OK '{ "firstName": "Kevin" }'
assert.deepStrictEqual(data, { firstName: 'Kevin' });
assert.strictEqual(status, 200);
assert.strictEqual(err, null);
```

## Integrations

`APIClient` by itself can be difficult to use from various locations in the
project, hence integrations are provided to use the client in a declarative
way. So far only `React` is supported.

## React

`substation` exports an `APIContext` which provides the `APIClient` to a number
of React hooks. These hooks may then be used within React components.

Though hooks are recommended, it is not necessary to use them to use
`substation` as both the React `Context.Provider` and `Context.Consumer`, which
provide `APIContext`, are exported by `substation`. This allows React projects
which are still migrating to hooks, or do not plan to use them to take
advantage of `substation`.

### `APIContext`

`APIContext` is a React context that provides `APIClient` to all components.

##### Example

```js
import {makeAPIClient, APIContext} from '@xorkevin/substation';

const App = () => {
  // application here
};

const apiConfig = { /* api config here */ };

const APIClient = makeAPIClient('/api', {}, apiConfig);

ReactDOM.render(
  <APIContext.Provider value={APIClient}>
    <App />

    {/* React consumer is also exported by APIContext.Consumer if not using hooks */}
    {/* (not recommended) */}
    <APIContext.Consumer>
      {apiclient => (/* use apiclient here */) }
    </APIContext.Consumer>
  </APIContext.Provider>,
  document.getElementById('mount'),
);
```

### Definitions

#### `selector`

Type: `Function(APIClient) -> route`

A `selector` returns a specific route from the `APIClient` to use.

##### Example

```js
const selectAPIUser = (api) => api.u.user.name;
```

#### `args`

Type: `Array`

`args` is an array of arguments that are passed to the `route` `transformer`
function.

#### `initState`

Type: `Object`

`initState` is the default value that is returned in the `apiState.data` field
before the HTTP request is successful.

#### `opts`

Type: `{prehook, posthook, errhook}`

`opts` contains a `prehook`, `posthook`, and `errhook` for the route.

#### `prehook`

Type: `async Function(args, {cancelRef}) -> string | undefined`

`prehook` is run just prior to when the route is executed. It takes the array
of arguments for the route `args` and a `cancelRef` of which
`cancelRef.current` is `true` if the api call has been cancelled. The `prehook`
may return an error in the form of a `string`. If an error is returned, then
the `route` immediately returns with that error and no HTTP request is made.
Typically `prehook` is used to validate data before the route is run.

#### `posthook`

Type: `async Function(status, data, {cancelRef}) -> string | undefined`

`posthook` is run after a route receives a successful HTTP response. It takes
the response status, body, and a `cancelRef` of which `cancelRef.current` is
`true` if the api call has been cancelled. The `posthook` may return an error
in the form of a `string`. If an error is returned, then the `route`
immediately returns with that error. Typically `posthook` is used to perform
some behavior after a successful HTTP request which may depend on the response.

#### `errhook`

Type: `async Function(string, err)`

`errhook` is run after any error is returned by either the prehook, route, or
posthook. The first argument will be set to `prehook`, `api`, and `posthook`
respectively in those situations. The error message will be passed as the
second argument. Typically `errhook` is used to perform some behavior after a
failed route execution such as display an error toast.

#### `apiState`

Type: `{loading: bool, success: bool, err: string | null, status: int, data: Object}`

`apiState` is one of the values returned by the `useResource` and `useAPICall`
hooks. It has the fields `loading` and `success` which are `true` when the
request is in flight, and if the request is successful, respectively. `err` is
not null when an error is returned from either the `prehook` or `posthook` or
by the request itself. `status` is the HTTP status, or -1 if the request was
not sent or failed to be sent. `data` is the `initState` by default, or the
response of the request or result of the route's `selector` if present.

#### `execute`

Type: `Function()`

`execute` is one of the values returned by `useAPICall`. When called, it
executes the entirety of the route, including the `prehook`, `posthook`, and
`errhook` as necessary.

#### `reexecute`

Type: `Function()`

`reexecute` is one of the values returned by `useResource`. When called, it
forces the entire route to be executed again, including the `prehook`,
`posthook`, and `errhook` as necessary.

### `useAPICall`

Type: `Function(selector, args = [], initState, opts) -> [apiState, execute]`

`useAPICall` should be used when one wants to have control over when the HTTP
request is made, such as when a button is clicked, or when another event is
triggered. Typically `useAPICall` is used for `POST`, `PUT`, `DELETE`, etc.

##### Example

```js
const selectAPIEdit = (api) => api.profile.edit;
const profileUpdatePrehook = ([body], {cancelRef}) => {
  if (body.name.length < 1) {
    return 'Name must be provided';
  }
  if (body.bio.length < 1) {
    return 'Bio must be provided';
  }
};
const profileUpdatePosthook = (_status, _data, {cancelRef}) => {
  console.log('Profile successfully updated');
};
const profileUpdateErrhook = (_stage, err) => {
  console.log('Profile update failed: ', err);
};

// within a component
const [apiState, execute] = useAPICall(
  selectAPIEdit,
  [{name: 'Kevin', bio: 'Web dev'}],
  {},
  {
    prehook: profileUpdatePrehook,
    posthook: profileUpdatePosthook,
    errhook: profileUpdateErrhook,
  },
);
const {loading, success, err, status, data} = apiState;

return <button onClick={execute}>Update</button>
```

### `useResource`

Type: `Function(selector, args = [], initState, opts) -> {...apiState, reexecute}`

`useResource` should be used when one wants to execute a route whenever the
arguments change. Equality is determined as defined by the React hooks docs
which uses
[Object.is](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is).
Typically `useResource` is used with a `GET` call to retrieve some resource
depending on some arguments.

```js
const selectAPIProfile = (api) => api.profile.get;

// within a component
const {loading, success, err, status, data} = useResource(selectAPIProfile, ['xorkevin'], {
  name: '',
  bio: '',
});

if (loading) {
  return <div>loading</div>;
}
if (success) {
  const {name, bio} = data;
  return (
    <div>
      <span>Name: {name}</span>
      <span>Bio: {bio}</span>
    </div>
  );
} else {
  return <div>Error: {err}</div>;
}
```

### `useURL`

Type: `Function(selector, args = []) -> String`

`useURL` takes an api `selector` and applies it to the current context's
`APIClient`. It then returns the formatted url path with the arguments
substituted. Typically this is used to get the urls for requests that aren't
made via JS, such as image content requests.

##### Example

```js
const selectAPIProfileImage = (api) => api.profile.id.image;

// within a component
const imageURL = useURL(selectAPIProfileImage, ['xorkevin']);
```

### `useAPI`

Type: `Function(selector) -> route`

`useAPI` takes an api `selector` and applies it to the current context's
`APIClient`.
