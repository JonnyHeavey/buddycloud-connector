# Buddycloud Yammer Connector

Provides a simple connector to copy messages backwards and forwards between Yammer and Buddycloud.

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
| `buddycloud.auth` | The authentication options to connect to your buddycloud server |
| `yammer.authtoken` | The oauth2 authentication token to connect to Yammer. Information on how to obtain one is available here: https://developer.yammer.com/authentication/#a-testtoken |
| `groups` | This is an array of all the groups you want mirrored. The Yammer group ids are available by logging into Yammer in your browser and then going to https://www.yammer.com/api/v1/groups.json?mine=1 |

## Current Implementation State

There is very little functionality implemented at the moment. This is what is implemented:

### Copying messages from Buddycloud to Yammer

New posts to Buddycloud are copied to the Yammer feed if there is a group set up in `config.groups`. Threading is maintained for new posts.