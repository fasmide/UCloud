import * as React from "react";

const SvgInfo = (props: any) => (
  <svg
    viewBox="0 0 25 25"
    xmlns="http://www.w3.org/2000/svg"
    fillRule="evenodd"
    clipRule="evenodd"
    fill="currentcolor"
    {...props}
  >
    <circle
      cx={424.005}
      cy={664.005}
      r={12.005}
      fill={props.color2 ? props.color2 : "currentcolor"}
      transform="matrix(1 0 0 1 -412.002 -652)"
    />
    <text
      x={586.816}
      y={629.892}
      fontFamily="'IBMPlexSerif-SemiBold','IBM Plex Serif SemiBold',serif"
      fontWeight={600}
      fontSize={24}
      fill={undefined}
      transform="matrix(1 0 0 1 -579.023 -609.246)"
    >
      {"i"}
    </text>
  </svg>
);

export default SvgInfo;
