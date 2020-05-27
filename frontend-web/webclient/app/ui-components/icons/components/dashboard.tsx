import * as React from "react";

const SvgDashboard = (props: any) => (
  <svg
    viewBox="0 0 25 24"
    fillRule="evenodd"
    clipRule="evenodd"
    fill="currentcolor"
    {...props}
  >
    <path
      d="M9 22.495v-3c0-.825.672-1.5 1.5-1.5h3c.828 0 1.5.675 1.5 1.5v3c0 .825-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.675-1.5-1.5zm-9-9v-3c0-.825.672-1.5 1.5-1.5h3c.828 0 1.5.675 1.5 1.5v3c0 .825-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.675-1.5-1.5zm0-9v-3c0-.826.672-1.5 1.5-1.5h3c.828 0 1.5.674 1.5 1.5v3c0 .825-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.675-1.5-1.5zm18 0v-3c0-.826.672-1.5 1.5-1.5h3c.828 0 1.5.674 1.5 1.5v3c0 .825-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.675-1.5-1.5z"
      fill={props.color2 ? props.color2 : "currentcolor"}
    />
    <path
      d="M0 22.495v-3c0-.825.672-1.5 1.5-1.5h3c.828 0 1.5.675 1.5 1.5v3c0 .825-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.675-1.5-1.5zm18 0v-3c0-.825.672-1.5 1.5-1.5h3c.828 0 1.5.675 1.5 1.5v3c0 .825-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.675-1.5-1.5zm-9-9v-3c0-.825.672-1.5 1.5-1.5h3c.828 0 1.5.675 1.5 1.5v3c0 .825-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.675-1.5-1.5zm9 0v-3c0-.825.672-1.5 1.5-1.5h3c.828 0 1.5.675 1.5 1.5v3c0 .825-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.675-1.5-1.5zm-9-9v-3c0-.826.672-1.5 1.5-1.5h3c.828 0 1.5.674 1.5 1.5v3c0 .825-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.675-1.5-1.5z"
      fill={undefined}
    />
  </svg>
);

export default SvgDashboard;
