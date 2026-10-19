# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

The integration stores in its `/data` volume the networks and stations you
added (`watch.json`), a copy of the station list of each network and of the
MobilityData catalog. No secret: the feeds it reads are public open data,
fetched over HTTPS from the operators' servers and from GitHub. It reads the
position of your Gladys houses (manifest `location`) to list the closest
stations; it is neither stored nor logged nor sent anywhere. The logs never
show the path nor the query string of a feed URL.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the bike sharing operators and their feeds.
