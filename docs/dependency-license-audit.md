# Dependency license audit — R1 persistence adapter

**Checked:** 2026-10-18<br>
**Verdict: CLEARED** for the newly introduced production dependency subtree only. This is not a full-repository or final-container SBOM review; the Node/Debian base image and OS packages are outside this audit.

## Scope and artifacts

The R1 addition is `better-sqlite3@13.0.3`, declared in `apps/server/package.json`. Its locked runtime dependency tree is:

| Component | Resolved artifact | Declared license | Artifact evidence |
| --- | --- | --- | --- |
| `better-sqlite3@13.0.3` | `better-sqlite3-13.0.3.tgz` | MIT | Lock integrity `sha512-RbOBxmLBG8uvFUc15X9+9SFemKcQ0WBuISBVkpuiaUB2qblC8UWlHEjdWVoZ8AdhSwmoEgsiXKfopX0CQxaACQ==`; bundled `package/LICENSE` SHA-256 `09856b52897c91ab67e7456ef43067019f31dfd3b87fda72e655736b1ebdee55` (1,078 bytes). |
| `node-addon-api@8.9.2` | `node-addon-api-8.9.2.tgz` | MIT | Lock integrity `sha512-VijLXbi3UACN69I0JVXJsX4tjACjNoQDgv2gTF6sx2wWEi8tkSg2eX8p5gSIFi8z2+DL3oHmY6OyKce38SDolg==`; bundled `package/LICENSE.md` SHA-256 `89024017b88a9f2b763f79b941a4f2db3b4428edfcacdc0b23866b2da633ad0c` (1,150 bytes). |

Both exact package tarballs were fetched with `npm pack`; their computed SHA-512 SRI values matched `package-lock.json`. The installed package manifests confirm that `better-sqlite3` has only `node-addon-api` as a runtime dependency and that `node-addon-api` has no further dependencies.

`better-sqlite3` also bundles the SQLite 3.53.4 amalgamation at `package/deps/sqlite3/sqlite3.c` (SHA-256 `6a2805f8c1ef020a7086e62258519323cf98b219e9fe87a42065d916cfebaefc`). Its source header contains the author’s copyright-disclaimer language; SQLite’s official copyright statement dedicates its deliverable code to the public domain: [SQLite Copyright](https://www.sqlite.org/copyright.html). The bundled `package/deps/patches/1208.patch` (SHA-256 `5d1f22d69fee3551b70a7b7b9b14be43fcfd04dbc8683233667abfa75905011a`) changes only two numeric constants in the SQLite date/time code.

## Limits

This clearance applies to the new persistence adapter’s npm package tree and bundled SQLite code. It does not clear the repository’s pre-existing dependency graph, the Docker base image, Debian packages installed in the build stage, or the complete deployed image. Those require a separately scoped full-image inventory if required for release.
