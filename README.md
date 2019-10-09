# substation
a data framework to power reactive apps

## Introduction

`substation` is a library that provides a declarative way to build web API
clients. It currently only supports HTTP rest APIs.

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
client. Conceptually, it treats an HTTP rest API as a tree of routes and
methods.

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

`makeAPIClient(baseUrl, baseOpts, apiConfig)`

#### `baseUrl`

Type: `String`

`baseUrl` is the base url which defines the root of an HTTP API.

##### Example

```js
const apiConfig = {
  hello: {
    url: '/hello',
    method: 'GET',
    expectdata: true,
    err: 'Could not say hello',
  },
};

const baseURL = '/api';

// APIClient consists of a function hello which makes a request to /api/hello
const APIClient = makeAPIClient(baseURL, {}, apiConfig);
await APIClient.hello();

const baseURL2 = '/api/v2';

// APIClient consists of a function hello which makes a request to
/api/v2/hello
const APIClient2 = makeAPIClient(baseURL, {}, apiConfig);
await APIClient2.hello();
```

#### `baseOpts`

`baseOpts` provides default values that are passed to the web [Fetch
API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). These values
are specified in the `init` section of the [fetch
documentation](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch).
`baseOpts` are set for all functions of an APIClient. They may be overriden on
a per function and call basis as described in the next section.
