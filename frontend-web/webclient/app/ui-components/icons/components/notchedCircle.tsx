import * as React from "react";

const SvgNotchedCircle = (props: any) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fillRule="evenodd"
    clipRule="evenodd"
    fill="currentcolor"
    {...props}
  >
    <path
      d="M3.227 3.813A11.993 11.993 0 0112.003 0C18.623 0 24 5.377 24 12s-5.376 12-11.997 12C6.15 24 1.143 19.776.17 14.005l2.958-.502A8.998 8.998 0 0012.003 21c4.961 0 8.993-4.033 8.993-9 0-4.968-4.032-9-8.993-9A9.009 9.009 0 005.42 5.86L3.227 3.812z"
      fill={undefined}
    />
  </svg>
);

export default SvgNotchedCircle;
