import * as React from "react";

const SvgFtFolderAlt = (props: any) => (
  <svg
    viewBox="0 0 25 23"
    xmlns="http://www.w3.org/2000/svg"
    fillRule="evenodd"
    clipRule="evenodd"
    fill="currentcolor"
    {...props}
  >
    <path
      d="M0 4.5A1.5 1.5 0 011.5 3h21A1.5 1.5 0 0124 4.5l.001 3.5h-24V4.5z"
      fill={props.color2 ? props.color2 : "currentcolor"}
    />
    <path
      d="M0 1.5A1.503 1.503 0 011.5 0H9l3 6h10.501a1.5 1.5 0 011.5 1.5V21a1 1 0 01-1 1H1a1 1 0 01-1-1V1.5z"
      fill={undefined}
    />
  </svg>
);

export default SvgFtFolderAlt;
