import type { ReactNode } from "react";
import { PixelWorkspace } from "./layout";

export function RoomWorkspace({
  pixel,
  ranking,
  information,
  children,
  legacyClassName,
  toggle,
}: {
  pixel: boolean;
  ranking: ReactNode;
  information: ReactNode;
  children: ReactNode;
  legacyClassName: string;
  toggle: ReactNode;
}) {
  return pixel ? (
    <PixelWorkspace left={ranking} right={information}>
      {children}
    </PixelWorkspace>
  ) : (
    <div className={legacyClassName}>
      {toggle}
      {ranking}
      {children}
      {information}
    </div>
  );
}
