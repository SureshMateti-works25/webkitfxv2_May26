import type { FormDefinition } from "@webkitfxv2/core-engine";
import login from "./login.json";
import shopperSignup from "./shopper-signup.json";
import vendorSignup from "./vendor-signup.json";

export const loginForm = login as FormDefinition;
export const vendorSignupForm = vendorSignup as FormDefinition;
export const shopperSignupForm = shopperSignup as FormDefinition;
