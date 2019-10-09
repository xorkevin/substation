# substation
a data framework to power reactive apps

# Introduction

`substation` is a library that provides a declarative way to build web API
clients. It currently only supports HTTP rest APIs.

# Installation

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

# Usage

`substation` has two halves: The first is a declarative API client builder in
the form of `makeAPIClient`. The second is a library of React hooks, such as
`useAPICall` and `useResource` which allow the API client to be used in a
declarative manner by React components. The former can be used independently of
the latter.

## `makeAPIClient`

`makeAPIClient` takes in a declarative API configuration and creates an API
client.

Example:

```js
const API = {
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

const BASEOPTS = Object.freeze({
  credentials: 'include',
});

const baseUrl = '/api';

const APIClient = makeAPIClient(baseUrl, BASEOPTS, API);
```
