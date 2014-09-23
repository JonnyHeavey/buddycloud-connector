# Buddycloud Connector

Provides a simple connector to copy messages backwards and forwards between Buddycloud and other stuff.

## Installation

Download the package (or git clone or whatever)

Edit the configuration:
```sh
$ cp config.example.js config.js
$ vim config.js
```

You might need to install libicu which is going to be specific to your OS

For RedHat:
```sh
$ sudo yum install libicu-devel
```

Then install all the npm gubbins and run it:
```sh
$ npm install
$ node index.html
```

## Configuration

| Config | Description |
| ------ | ----------- |
| `plugins` | The set of plugins to load |
| `plugins.<plugin_name>.clazz` | The class of the plugin - this will be instatiated with `new` |
| `plugins.<plugin_name>.config` | The plugin config which will be passed into the constructor when it's instatiated |
| `plugins.<plugin_name>.authMapper` | An optional set of mapper functions to transform user identifiers |
| `plugins.<plugin_name>.channelMapper` | An optional set of mapper functions to transform channel identifiers |
| `dataDir` | The directory into which to store the NeDB data files |

## Included Plugins

### Buddycloud Plugin

#### Configuration

| Config | Description |
| ------ | ----------- |
| `auth` | The authentication options to connect to your buddycloud server |

### Yammer Plugin

#### Configuration

| Config | Description |
| ------ | ----------- |
| `authtoken` | The oauth2 authentication token to connect to Yammer. Information on how to obtain one is available here: https://developer.yammer.com/authentication/#a-testtoken |
