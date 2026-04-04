export type CheckStatus = "pass" | "warn" | "fail";

export type CheckResult = {
  name: string;
  status: CheckStatus;
  message: string;
};
