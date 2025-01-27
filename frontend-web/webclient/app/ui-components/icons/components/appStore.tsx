import * as React from "react";

const SvgAppStore = (props: any) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fillRule="evenodd"
    clipRule="evenodd"
    fill="currentcolor"
    {...props}
  >
    <path
      d="M22.24 6.491H1.754C.79 6.491 0 7.407 0 8.525v13.44C0 23.086.79 24 1.754 24h20.491C23.21 24 24 23.084 24 21.966V8.526c-.005-1.12-.795-2.035-1.76-2.035zm-1.345-1.623H3.1c-.385 0-.7-.365-.7-.811 0-.446.315-.812.7-.812h17.796c.385 0 .7.366.7.812 0 .446-.315.811-.7.811zm-1.54-3.245H4.64c-.35 0-.64-.336-.64-.742V.74c0-.405.29-.741.64-.741h14.717c.35 0 .64.336.64.742V.88c0 .406-.29.742-.64.742z"
      fill={undefined}
      fillRule="nonzero"
    />
    <path
      d="M8 10.567c0-.208.118-.387.326-.491a.704.704 0 01.65.004l8.703 4.432c.205.104.321.28.321.487 0 .205-.116.384-.321.488l-8.702 4.432a.717.717 0 01-.65.004C8.117 19.819 8 19.64 8 19.43v-8.864z"
      fill={props.color2 ? props.color2 : "currentcolor"}
    />
  </svg>
);

export default SvgAppStore;
