# Signal Prediction

Static workshop frontend for `RitualPredict.sol`.

Open `index.html` directly in a browser:

```text
web/index.html
```

The interface is intentionally different from the referenced TEEGENT demo. It focuses on:

- autonomous resolution status,
- oracle read health,
- scheduled callback visibility,
- market odds and pool inspection,
- a local create-market draft form.

The current UI is a static prototype. After contract deployment, the form and market actions can be
wired to `createMarket`, `bet`, `status`, and `claimWinnings` calls.
