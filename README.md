# Minnsace Inc. studio website

Static, responsive website for **Minnsace Inc.**, built for `https://minnsace.com`.
The site presents the studio, its released game **Deadlight Tavern**, the official
[Steam store page](https://store.steampowered.com/app/2071710/), and
`hello@minnsace.com`. It has no JavaScript, framework, third-party embeds, or build
dependencies. Brand images are supplied by the studio; `minnsace-logo.png` is a
crop of the supplied wordmark. The game tile is typographic site artwork, not a
gameplay screenshot.

## Local checks and preview

With Node.js 20 or newer installed, from the repository root:

```powershell
npm run check
```

No install or build step is needed. Open `index.html` in a browser, or use your
preferred static HTTP server. Check desktop and narrow mobile widths, keyboard
navigation, the Steam link, and the email link. The automated check verifies local
links and anchors, metadata, image alt attributes, required images, sitemap entries,
deployment inputs, and absence of outdated VR claims; it is not a full HTML or
accessibility audit.

The studio confirmed that Deadlight Tavern is released, free on Steam, and no
longer a VR game. The Steam listing is outdated: do not copy its VR requirements,
gameplay details, or other unconfirmed information into the website.

## GitHub Pages setup

1. Publish the site files to the repository's `main` branch.
2. In [repository Pages settings](https://github.com/minnsace/minnsace.com/settings/pages),
   select **GitHub Actions** as the build and deployment source.
3. Set **Custom domain** to `minnsace.com` and save **before changing DNS**.
   The included `CNAME` records the intended domain in source control, but GitHub
   ignores that file for Actions deployments: Pages settings must also be set.
4. The **Deploy studio website** workflow runs on pushes to `main`. You can also
   run it manually from Actions, selecting `main`. It validates the site,
   packages only public site files, and deploys to the `github-pages` environment.
5. Apply the DNS changes below. Wait for the Pages DNS check and certificate
   provisioning to finish, then enable **Enforce HTTPS**.

The workflow deliberately does not deploy arbitrary feature branches. No
repository secrets are required. If policy requires approvals for the
`github-pages` environment, approve the deployment under Actions.

## Exact GoDaddy DNS records

In GoDaddy: **My Products → Domains → minnsace.com → DNS → Manage DNS**.
First inspect existing records. Replace any parking or conflicting web-hosting
records for `@` and `www`; disable domain forwarding if configured. **Do not remove
MX, email-related TXT, or other unrelated records.** Domain registration and
email hosting do not need to move to GitHub.

Create these records (TTL: **1 hour**, or GoDaddy's default if unavailable):

| Type | Name / Host | Value / Points to |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `minnsace.github.io` |

IPv6 is optional. If using AAAA records for the apex, use the complete GitHub
Pages set below, replacing any old apex AAAA records so IPv6 users do not reach
the previous host. If not using IPv6, remove stale apex AAAA records.

| Type | Name / Host | Value / Points to |
|---|---|---|
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

Do not use a CNAME at `@`, point DNS to a repository path, enter `https://` in a
DNS value, or create wildcard DNS records. The `www` CNAME targets the account
hostname, **not** `minnsace.github.io/minnsace.com`.

For takeover protection, verify the domain under the **minnsace account's Pages
settings** before pointing DNS at GitHub. GitHub supplies a TXT host beginning
`_github-pages-challenge-minnsace` and a unique value. Copy the exact host/value
GitHub provides into GoDaddy and keep the TXT record after verification. Do not
guess this token.

DNS changes can take up to 24 hours to propagate. HTTPS certificate issuance may
take additional time after DNS is correct. If CAA records are present, ensure
they permit `letsencrypt.org` before requesting a Pages certificate.

Sources:
- [GitHub: managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub: verifying your custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [GitHub: securing Pages with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

## Go-live checklist

- Confirm `https://minnsace.com` serves this site publicly, without a login or
  registrar parking page, and the browser reports a valid HTTPS certificate.
- Confirm `https://www.minnsace.com` redirects to the apex domain and the game,
  studio, contact, and privacy links work on mobile and desktop.
- Confirm `hello@minnsace.com` is a real, working mailbox. This repository does
  **not** provision email or change mail DNS records.
- Use the exact legal organization name matching the Apple Developer enrollment
  and business records. The website identifies the organization as Minnsace Inc.
- Submit `https://minnsace.com` only after it resolves and functions publicly.
  The website supports the quoted website requirement, but Apple determines
  enrollment eligibility and may request other organization documentation.

## Editing

Edit `index.html`, `privacy.html`, and `styles.css` directly. Keep company and game
claims grounded in confirmed information. Keep Steam App ID `2071710` in store links.
Only files explicitly copied into `_site` by the deployment workflow are published.
