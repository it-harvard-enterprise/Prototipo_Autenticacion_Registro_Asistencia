declare global {
  var WebSdk:
    | {
        WebChannelClient?: unknown;
      }
    | undefined;

  var dp:
    | {
        devices?: unknown;
      }
    | undefined;
}

export {};
