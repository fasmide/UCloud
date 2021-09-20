import * as React from "react";
import {HairProps} from "@/UserSettings/AvatarOptions";
import {generateId as uniqueId} from "@/UtilityFunctions";
import FacialHair from "./facialHair";
import HairColor from "./HairColor";

export default class LongHairStraight extends React.Component<HairProps> {
  public static optionValue = "LongHairStraight";
  private mask1 = uniqueId("react-mask-");
  private mask2 = uniqueId("react-mask-");
  private path1 = uniqueId("react-path-");
  private path2 = uniqueId("react-path-");

  public render() {
    const { mask1, mask2, path1, path2 } = this;
    return (
      <g id="Top" strokeWidth="1" fillRule="evenodd">
        <defs>
          <rect id={path1} x="0" y="0" width="264" height="280" />
          <path
            d="M133.506381,81.3351151 C137.363649,83.3307002 140,87.3574737 140,92 L140,105 C140,111.018625 135.569129,116.002364 129.791419,116.867187 C128.048193,137.114792 115.530782,154.282984 98,162.610951 L98,162.610951 L98,181 L102,181 C119.490913,181 135.525121,187.236892 148,197.608051 L148,74 C148,53.5654643 139.717268,35.0654643 126.325902,21.6740982 C112.934536,8.28273213 94.4345357,-3.55271368e-15 74,0 C33.1309285,7.10542736e-15 -7.10542736e-15,33.1309285 0,74 L0,257.716445 C13.5691766,255.775526 24,244.105888 24,230 L24,184.423101 C30.9346808,182.200199 38.3271796,181 46,181 L50,181 L50,162.610951 C38.7726252,157.277407 29.6015372,148.317951 24,137.245847 L24,75.2659587 C33.1467898,72.2910056 42.777598,68.0170651 52.3415164,62.4953343 C67.7445474,53.6023901 80.4313947,42.9409152 89.0661426,32.3970356 C90.8310687,37.5951441 93.1752556,42.8009742 96.1104311,47.8848473 C104.877881,63.0705152 117.224186,74.2337047 130,79.9170491 L130,80.1659169 C130.400422,80.233095 130.794121,80.3201038 131.18005,80.4258987 C131.954509,80.7493055 132.730185,81.0524853 133.506381,81.3351151 Z"
            id={path2}
          />
        </defs>
        <mask id={mask1} fill="white">
          <use xlinkHref={"#" + path1} />
        </mask>
        <g id="Mask" />
        <g id="Top/Long-Hair/Straight" mask={`url(#${mask1})`}>
          <g transform="translate(-1.000000, 0.000000)">
            <g
              id="Hair"
              strokeWidth="1"
              fill="none"
              fillRule="evenodd"
              transform="translate(59.000000, 18.000000)">
              <mask id={mask2} fill="white">
                <use xlinkHref={"#" + path2} />
              </mask>
              <use id="Mask-Hair" fill="#944F23" xlinkHref={"#" + path2} />
              <HairColor optionValue={this.props.hairColor} maskID={mask2} />
            </g>
            <path
              d="M192.506381,99.3351151 C197.3745,101.107702 202.263079,102.071957 207,102.148232 L207,102.148232 L207,92 C207,71.5654643 198.717268,53.0654643 185.325902,39.6740982 C198.717268,53.0654643 207,71.5654643 207,92 L207,215.608051 C194.525121,205.236892 178.490913,199 161,199 L157,199 L157,180.610951 L157,180.610951 C174.530782,172.282984 187.048193,155.114792 188.791419,134.867187 C194.569129,134.002364 199,129.018625 199,123 L199,110 C199,105.357474 196.363649,101.3307 192.506381,99.3351151 Z M190.18005,98.4258987 C189.794121,98.3201038 189.400422,98.233095 189,98.1659169 L189,97.9170491 C189.392974,98.0918644 189.786355,98.2614951 190.18005,98.4258987 Z M83,155.245847 C88.6015372,166.317951 97.7726252,175.277407 109,180.610951 L109,199 L105,199 C97.3271796,199 89.9346808,200.200199 83,202.423101 L83,155.245847 Z"
              id="Shadow"
              fillOpacity="0.24"
              fill="#000000"
              fillRule="evenodd"
            />
            <FacialHair {...this.props} />
            {this.props.children}
          </g>
        </g>
      </g>
    );
  }
}
