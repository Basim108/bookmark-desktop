# Setting up the release credentials

One-time setup that lets `.github/workflows/release.yml` publish to the Chrome
Web Store. Takes about fifteen minutes, and once done it does not need doing
again — unless the refresh token is revoked or expires, which is what most of
this document is about avoiding.

At the end you will have four repository secrets:

| Secret                 | What it is                                      |
| ---------------------- | ----------------------------------------------- |
| `CHROME_CLIENT_ID`     | Identifies the OAuth client you create          |
| `CHROME_CLIENT_SECRET` | Its password                                    |
| `CHROME_REFRESH_TOKEN` | Lets the workflow act as you, without a browser |
| `CHROME_EXTENSION_ID`  | Which store item to upload to                   |

No signing key. Store uploads are plain zips and Google signs the published
item; the `.pem` in `SECURITY.md` is for self-distribution only.

**Do the steps in order.** Step 3 must happen before step 5, and doing them the
other way round produces credentials that work for a week and then fail — see
"Why the publishing status matters" below, which is the single most important
paragraph here.

---

## Before you start

- A Google account that can see the extension in the
  [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
  It must be the account that owns or is a publisher of the item; a different
  account will authenticate fine and then be refused at upload.
- Admin access to the GitHub repository, to add secrets.

---

## Step 1 — Create a Google Cloud project

The OAuth client has to live in a project.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar, then **New Project**.
3. Name it something you will recognise in a year —
   `bookmark-desktop-release` rather than `My Project 48271`.
4. Create it, then make sure it is the selected project before continuing.
   Every step below applies to the selected project, and configuring the wrong
   one is easy and produces confusing failures.

**Why:** the project is the container for the API access and the credentials.
Nothing about it is visible to users of the extension.

---

## Step 2 — Enable the Chrome Web Store API

1. Go to **APIs & Services → Library**.
2. Search for **Chrome Web Store API**.
3. Open it and click **Enable**.

**Why:** Google APIs are off by default per project. Skipping this produces a
`403` at upload time with a message about the API not being enabled for the
project — clear enough, but only if you know to look at the project rather than
the credentials.

---

## Step 3 — Configure the OAuth consent screen

**This is the step that decides whether your credentials last.** Read the
explanation before clicking.

Go to **APIs & Services → OAuth consent screen**.

### Choosing the user type

You are offered **Internal** or **External**:

- **Internal** — only available if your Google account belongs to a Google
  Workspace organisation. Choose it if offered. Tokens do not expire, and there
  is no verification or warning screen.
- **External** — the only option for a personal `@gmail.com` account. Choose
  this, then follow "Publishing status" below, which is mandatory rather than
  optional.

Fill in the required fields (app name, your email as support and developer
contact). Nobody will see this screen except you: the "app" is your own release
pipeline, not something you are distributing.

When asked for scopes, you may add
`https://www.googleapis.com/auth/chromewebstore`, or leave it and let the
authorisation request in step 5 ask for it. Either works.

### Publishing status — why it matters

If you chose **External**, the consent screen has a publishing status, and it
starts as **Testing**.

> **A refresh token issued while the consent screen is in Testing expires after
> seven days.**

This is Google's documented behaviour, not a quirk of this repository. The
consequence is specific and nasty:

```
Day 0   You finish this guide. You publish a release. It works.
        Everything looks correct, because it is.

Day 8   You publish a release. It fails:

            invalid_grant

        Nothing has changed. The workflow is fine. The secrets are
        still there. The extension is fine. The token silently died.
```

There is no warning, and nothing in the failure names the cause. It is the most
common way Chrome Web Store automation breaks, and it breaks long after the
person who set it up has stopped thinking about it.

**So, before generating any token:**

1. On the OAuth consent screen page, find **Publishing status**.
2. Click **Publish app** and confirm.
3. Confirm the status now reads **In production**.

**Two things people get wrong here:**

- **Publishing afterwards does not fix an existing token.** A token minted under
  Testing stays short-lived forever. If you already generated one, publish the
  app and then generate a _new_ token — step 5 again.
- **You do not need Google's verification.** Publishing to production will warn
  you that the app uses a sensitive scope and may require verification. That
  applies to distributing the app to other people. You are the only user, so
  ignore it. In step 5 the browser will show "Google hasn't verified this app";
  click **Advanced → Go to (unsafe)**. This is expected and correct — the
  "unverified app" is your own.

No automation can check any of this. A seven-day token is indistinguishable
from a permanent one until the day it stops working, which is why this document
exists.

---

## Step 4 — Create the OAuth client

1. Go to **APIs & Services → Credentials**.
2. **Create Credentials → OAuth client ID**.
3. Application type: **Desktop app**.
4. Name it (again, something recognisable).
5. Create. A dialog shows your **Client ID** and **Client secret**.

**Copy both somewhere safe now.** You need them in the next step and in step 7.
The secret can be retrieved later from the same page, but it is easier not to
have to.

**Why "Desktop app":** it permits a loopback (`http://localhost`) redirect,
which is what step 5 uses. A "Web application" client would require you to
register a redirect URI up front.

---

## Step 5 — Generate the refresh token

You authorise once, in a browser, and exchange the result for a token the
workflow can use forever without a browser.

> Check first: does the consent screen say **In production** (or is it
> Internal)? If not, go back to step 3. Doing this step now produces a token
> that dies in a week.

### 5a. Build the authorisation URL

Replace `YOUR_CLIENT_ID`, then open the result in a browser:

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&response_type=code&access_type=offline&prompt=consent&scope=https://www.googleapis.com/auth/chromewebstore
```

Two parameters carry the weight:

- `access_type=offline` — asks for a refresh token, not just a short-lived
  access token. Without it you get no refresh token at all.
- `prompt=consent` — forces the consent screen even if you have approved
  before. Google only returns a refresh token on a fresh consent, so without
  this a second attempt silently returns none.

### 5b. Approve, and take the code from the URL bar

- Sign in as the account that owns the extension.
- If you see "Google hasn't verified this app", click **Advanced → Go to
  (unsafe)**. Expected — see step 3.
- Approve the request.

The browser then tries to load `http://localhost/?code=...` and **fails to
connect**. That is fine and expected: nothing is listening there. What you need
is in the address bar.

Copy the value of `code=` — everything between `code=` and the next `&`, if
there is one. It looks like `4/0AVMBsJ...`.

The code is single-use and expires within minutes. If the next step fails with
`invalid_grant`, the code was already used or has expired — repeat 5a and 5b for
a fresh one.

### 5c. Exchange the code for a refresh token

Fill in the three values and run:

```bash
curl -s -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=THE_CODE_FROM_THE_URL_BAR" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://localhost"
```

The response contains `refresh_token`:

```json
{
  "access_token": "ya29....",
  "expires_in": 3599,
  "refresh_token": "1//0g...",
  "scope": "https://www.googleapis.com/auth/chromewebstore",
  "token_type": "Bearer"
}
```

**`refresh_token` is what you need.** The `access_token` is not — it lasts an
hour, and the workflow mints its own from the refresh token each run.

If the response has **no** `refresh_token`, you almost certainly omitted
`access_type=offline` or `prompt=consent` in 5a. Redo 5a with both.

Treat this value like a password. It grants publishing rights to your extension
until revoked, and it is not recoverable — losing it means repeating step 5.

---

## Step 6 — Find the extension ID

1. Open the
   [Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Click the extension.
3. The ID is the 32-character lowercase string in the address bar:

```
https://chrome.google.com/webstore/devconsole/.../ITEM_ID_IS_HERE/edit
```

It also appears on the item's dashboard page, and it matches the ID shown at
`chrome://extensions` for the installed store version.

---

## Step 7 — Add the four secrets to GitHub

1. Repository → **Settings → Secrets and variables → Actions**.
2. **New repository secret**, once per row:

| Name                   | Value                              |
| ---------------------- | ---------------------------------- |
| `CHROME_CLIENT_ID`     | from step 4                        |
| `CHROME_CLIENT_SECRET` | from step 4                        |
| `CHROME_REFRESH_TOKEN` | from step 5c — the `refresh_token` |
| `CHROME_EXTENSION_ID`  | from step 6                        |

Names must match exactly; the workflow reads them by name and refuses to run
with a message naming any that are missing.

**Repository secrets, not environment or organisation secrets** — that is where
`release.yml` looks. They are write-only once saved: you can replace a secret
but never read it back, so keep the refresh token somewhere safe if you want to
avoid repeating step 5.

The release workflow has no `pull_request` trigger, so a pull request from a
fork cannot reach these values.

---

## Checking it worked

The honest test is a real release, since the store has no sandbox. But you can
confirm the credentials independently, without uploading anything:

```bash
curl -s -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "refresh_token=YOUR_REFRESH_TOKEN" \
  -d "grant_type=refresh_token"
```

An `access_token` in the response means the credentials work. An `invalid_grant`
means they do not — see below.

Then follow "Cutting a release" in
[`store-submission.md`](./store-submission.md).

---

## Troubleshooting

### `invalid_grant` when exchanging the refresh token

In order of likelihood:

1. **The token expired because the consent screen was in Testing when it was
   generated.** The classic case, and it appears roughly a week after a setup
   that seemed to work. Fix: publish the consent screen (step 3), generate a
   **new** token (step 5), update the secret. Publishing alone does not revive
   the old token.
2. **The token was revoked** — by removing the app at
   [Google account permissions](https://myaccount.google.com/permissions), by a
   password change, or by regenerating the client secret. Repeat step 5.
3. **Client ID and secret do not belong together**, e.g. copied from two
   different clients or two different projects.

### `invalid_grant` when exchanging the authorisation code (step 5c)

The code is single-use and short-lived. Get a fresh one: repeat 5a and 5b.

### No `refresh_token` in the response

`access_type=offline` or `prompt=consent` was missing from the authorisation
URL. Redo 5a with both.

### `403` — API not enabled

Step 2, and check you are in the right project.

### `401` at upload, but the token exchange works

The authorised account cannot publish this item. It must own the extension, or
be a publisher on it, in the Developer Dashboard.

### The workflow says a secret is not set

The name does not match, or it was added as an environment or organisation
secret rather than a repository secret. Step 7.

---

## When the token needs replacing

The refresh token is long-lived, not eternal. Regenerate it (step 5) and update
the `CHROME_REFRESH_TOKEN` secret if:

- you revoke the app's access from your Google account;
- you regenerate the OAuth client secret (which also means updating
  `CHROME_CLIENT_SECRET`);
- you change the Google account that publishes the extension;
- a release fails with `invalid_grant` for any of the reasons above.

Nothing else in this guide needs redoing — the project, the API, the consent
screen, and the client all persist.
