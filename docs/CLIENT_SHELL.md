# Client shell binding

**Status:** Locked  
**Decision:** Cos LOCK, November 2, 2026, about 7:29 PM ET (America/New_York)  
**Locked by:** Cos  
**Council:** Owner, EL, SA, QA, Hyg, Cost Keeper, and Prioritizer — unanimous on staying with React Native

This is the client-shell decision for KidCoord. It records the shell only. It does not un-park the product, and it does not authorize feature work.

## Locked

The client is fully native React Native. Continue the existing React Native 0.73 client in this repository (`react-native` 0.73.0 at the repo root). iOS and Android ship from that client.

## Rejected

A hybrid WebView shell is rejected. Do not wrap the product in a web view and treat that wrapper as the app.

## Not binding

A PWA, or an Add-to-Home-Screen page, is not a binding platform choice.

It is a compromise only if Cos and K later consciously make SMS or email the primary wake channel. Until that separate decision, any PWA or home-screen page is a trial or share surface only. It is never the handoff system of record.

## Unchanged

These stay as they were when Cos locked the shell:

- Unpark
- Dig READY
- Binding A
- Feature digs

The product stays **parked** for features. Dig invents Dig OUT until Cos un-parks. Do not read this lock as permission to start a feature dig, a client rewrite, or a new shell.

## Where the client lives

The runnable client is the React Native app at the repository root (`package.json`, `src/`). The backend is the API. It is not the client shell. "Thin client" in the legal and regulatory notes means the native app presents server-owned rules and documents. It does not mean a WebView or a PWA.
