import { Suspense } from "react";
import { lazyScreen } from "../lib/lazyScreen";
import ScreenFallback from "../components/ScreenFallback";

const AdminScreen = lazyScreen(() => import("./AdminScreen"));

export default function LazyAdminScreen() {
  return <Suspense fallback={<ScreenFallback />}><AdminScreen /></Suspense>;
}
