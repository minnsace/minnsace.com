# Minnsace Inc. website

Official studio website for Minnsace Inc., the studio behind [Deadlight Tavern](https://store.steampowered.com/app/2071710/), available free to play on Steam.

## Publishing

The site is static HTML and CSS. `.github/workflows/pages.yml` publishes the repository root to GitHub Pages when changes are pushed to `main` or the workflow is manually run.

## Custom domain

The configured domain is `minnsace.com`. In GoDaddy DNS, point the apex (`@`) to GitHub Pages using four A records:

| Type | Host | Points to |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | minnsace.github.io |

Optional IPv6 records: AAAA `@` to `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, and `2606:50c0:8003::153`. Keep existing mail/MX records. Remove conflicting GoDaddy parking A/AAAA records. In the repository, use **Settings → Pages**, select **GitHub Actions** as the source, set the custom domain to `minnsace.com`, and enable **Enforce HTTPS** after DNS propagates and GitHub issues a certificate.

DNS changes can take up to 24 hours to propagate. Apple makes the final determination about Developer Program organization enrollment; a website cannot guarantee acceptance.