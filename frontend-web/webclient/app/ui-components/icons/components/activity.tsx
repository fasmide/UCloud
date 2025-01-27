import * as React from "react";

const SvgActivity = (props: any) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fillRule="evenodd"
    clipRule="evenodd"
    fill="currentcolor"
    {...props}
  >
    <path
      d="M8.377 8.571L1 1 0 9.487l8.377-.916z"
      fill={undefined}
      fillRule="nonzero"
    />
    <path
      d="M3.227 3.813A11.993 11.993 0 0112.003 0C18.623 0 24 5.377 24 12s-5.376 12-11.997 12C6.15 24 1.143 19.776.17 14.005l2.958-.502A8.998 8.998 0 0012.003 21c4.961 0 8.993-4.033 8.993-9 0-4.968-4.032-9-8.993-9A9.009 9.009 0 005.42 5.86L3.227 3.812z"
      fill={undefined}
    />
    <path
      fill={props.color2 ? props.color2 : "currentcolor"}
      fillRule="nonzero"
      d="M14.873 15.442l-2.358 1.026-1.994-4.585 2.358-1.026z"
    />
    <path
      fill={props.color2 ? props.color2 : "currentcolor"}
      fillRule="nonzero"
      d="M14.359 6.05l2.146 1.416-3.854 5.843-2.147-1.416z"
    />
  </svg>
);

export default SvgActivity;
