import * as React from "react";
import {Clothes as ClothesOpts, ClothesGraphic, ColorFabric} from "@/UserSettings/AvatarOptions";
import {generateId as uniqueId} from "@/UtilityFunctions";
import Colors from "./Colors";
import Graphics from "./Graphics";

export default function Clothes(props: {optionValue: ClothesOpts, graphic: ClothesGraphic, color: ColorFabric}): JSX.Element {
    const {color, graphic} = props;
    switch (props.optionValue) {
        case ClothesOpts.BlazerShirt:
            return <BlazerShirt />;
        case ClothesOpts.BlazerSweater:
            return <BlazerSweater />;
        case ClothesOpts.CollarSweater:
            return <CollarSweater color={color} />;
        case ClothesOpts.GraphicShirt:
            return <GraphicShirt color={color} graphic={graphic} />;
        case ClothesOpts.Hoodie:
            return <Hoodie color={color} />;
        case ClothesOpts.Overall:
            return <Overall color={color} />;
        case ClothesOpts.ShirtCrewNeck:
            return <ShirtCrewNeck color={color} />;
        case ClothesOpts.ShirtScoopNeck:
            return <ShirtScoopNeck color={color} />;
        case ClothesOpts.ShirtVNeck:
            return <ShirtVNeck color={color} />;
    }
}

class BlazerShirt extends React.Component {
    static optionValue = 'BlazerShirt';

    private path1 = uniqueId('react-path-');
    private mask1 = uniqueId('react-mask-');

    render() {
        const {path1, mask1} = this;
        return (
            <g
                id='Clothing/Blazer-+-Shirt'
                transform='translate(0.000000, 170.000000)'>
                <defs>
                    <path
                        d='M133.960472,0.294916112 C170.936473,3.32499816 200,34.2942856 200,72.0517235 L200,81 L0,81 L0,72.0517235 C1.22536245e-14,33.9525631 29.591985,2.76498122 67.0454063,0.219526408 C67.0152598,0.593114549 67,0.969227185 67,1.34762511 C67,13.2107177 81.9984609,22.8276544 100.5,22.8276544 C119.001539,22.8276544 134,13.2107177 134,1.34762511 C134,0.994669088 133.986723,0.64370138 133.960472,0.294916112 Z'
                        id={path1}
                    />
                </defs>
                <g id='Shirt' transform='translate(32.000000, 29.000000)'>
                    <mask id={mask1} fill='white'>
                        <use xlinkHref={'#' + path1} />
                    </mask>
                    <use id='Clothes' fill='#E6E6E6' xlinkHref={'#' + path1} />
                    <g id='Color/Palette/Black' mask={`url(#${mask1})`} fill='#262E33'>
                        <g transform='translate(-32.000000, -29.000000)' id='🖍Color'>
                            <rect x='0' y='0' width='264' height='110' />
                        </g>
                    </g>
                    <g
                        id='Shadowy'
                        opacity='0.599999964'
                        mask={`url(#${mask1})`}
                        fillOpacity='0.16'
                        fill='#000000'>
                        <g transform='translate(60.000000, -25.000000)' id='Hola-👋🏼'>
                            <ellipse
                                cx='40.5'
                                cy='27.8476251'
                                rx='39.6351047'
                                ry='26.9138272'
                            />
                        </g>
                    </g>
                </g>
                <g id='Blazer' transform='translate(32.000000, 28.000000)'>
                    <path
                        d='M68.784807,1.12222847 C30.512317,2.80409739 -1.89486556e-14,34.3646437 -1.42108547e-14,73.0517235 L0,73.0517235 L0,82 L69.3616767,82 C65.9607412,69.9199941 64,55.7087296 64,40.5 C64,26.1729736 65.7399891,12.7311115 68.784807,1.12222847 Z M131.638323,82 L200,82 L200,73.0517235 C200,34.7067641 170.024954,3.36285166 132.228719,1.17384225 C135.265163,12.7709464 137,26.1942016 137,40.5 C137,55.7087296 135.039259,69.9199941 131.638323,82 Z'
                        id='Saco'
                        fill='#3A4C5A'
                    />
                    <path
                        d='M149,58 L158.555853,50.83311 L158.555853,50.83311 C159.998897,49.7508275 161.987779,49.7682725 163.411616,50.8757011 L170,56 L149,58 Z'
                        id='Pocket-hanky'
                        fill='#E6E6E6'
                    />
                    <path
                        d='M69,1.13686838e-13 C65,19.3333333 66.6666667,46.6666667 74,82 L58,82 L44,46 L50,37 L44,31 L63,1 C65.027659,0.369238637 67.027659,0.0359053037 69,1.13686838e-13 Z'
                        id='Wing'
                        fill='#2F4351'
                    />
                    <path
                        d='M151,1.13686838e-13 C147,19.3333333 148.666667,46.6666667 156,82 L140,82 L126,46 L132,37 L126,31 L145,1 C147.027659,0.369238637 149.027659,0.0359053037 151,1.13686838e-13 Z'
                        id='Wing'
                        fill='#2F4351'
                        transform='translate(141.000000, 41.000000) scale(-1, 1) translate(-141.000000, -41.000000) '
                    />
                </g>
            </g>
        )
    }
}

class BlazerSweater extends React.Component {
    static optionValue = 'BlazerSweater';

    private path1 = uniqueId('react-path-');
    private mask1 = uniqueId('react-mask-');

    render() {
        const {path1, mask1} = this;
        return (
            <g
                id='Clothing/Blazer-+-Sweater'
                transform='translate(0.000000, 170.000000)'>
                <defs>
                    <path
                        d='M105.192402,29.0517235 L104,29.0517235 L104,29.0517235 C64.235498,29.0517235 32,61.2872215 32,101.051724 L32,110 L232,110 L232,101.051724 C232,61.2872215 199.764502,29.0517235 160,29.0517235 L160,29.0517235 L158.807598,29.0517235 C158.934638,30.0353144 159,31.0364513 159,32.0517235 C159,45.8588423 146.911688,57.0517235 132,57.0517235 C117.088312,57.0517235 105,45.8588423 105,32.0517235 C105,31.0364513 105.065362,30.0353144 105.192402,29.0517235 Z'
                        id={path1}
                    />
                </defs>
                <mask id={mask1} fill='white'>
                    <use xlinkHref={'#' + path1} />
                </mask>
                <use
                    id='Clothes'
                    fill='#E6E6E6'
                    fillRule='evenodd'
                    xlinkHref={'#' + path1}
                />
                <g
                    id='Color/Palette/Black'
                    mask={`url(#${mask1})`}
                    fillRule='evenodd'
                    fill='#262E33'>
                    <rect id='🖍Color' x='0' y='0' width='264' height='110' />
                </g>
                <g
                    id='Blazer'
                    strokeWidth='1'
                    fillRule='evenodd'
                    transform='translate(32.000000, 28.000000)'>
                    <path
                        d='M68.784807,1.12222847 C30.512317,2.80409739 1.24427139e-14,34.3646437 0,73.0517235 L0,82 L69.3616767,82 C65.9607412,69.9199941 64,55.7087296 64,40.5 C64,26.1729736 65.7399891,12.7311115 68.784807,1.12222847 Z M131.638323,82 L200,82 L200,73.0517235 C200,34.7067641 170.024954,3.36285166 132.228719,1.17384225 C135.265163,12.7709464 137,26.1942016 137,40.5 C137,55.7087296 135.039259,69.9199941 131.638323,82 Z'
                        id='Saco'
                        fill='#3A4C5A'
                    />
                    <path
                        d='M149,58 L158.555853,50.83311 L158.555853,50.83311 C159.998897,49.7508275 161.987779,49.7682725 163.411616,50.8757011 L170,56 L149,58 Z'
                        id='Pocket-hanky'
                        fill='#E6E6E6'
                    />
                    <path
                        d='M69,1.13686838e-13 C65,19.3333333 66.6666667,46.6666667 74,82 L58,82 L44,46 L50,37 L44,31 L63,1 C65.027659,0.369238637 67.027659,0.0359053037 69,1.13686838e-13 Z'
                        id='Wing'
                        fill='#2F4351'
                    />
                    <path
                        d='M151,1.13686838e-13 C147,19.3333333 148.666667,46.6666667 156,82 L140,82 L126,46 L132,37 L126,31 L145,1 C147.027659,0.369238637 149.027659,0.0359053037 151,1.13686838e-13 Z'
                        id='Wing'
                        fill='#2F4351'
                        transform='translate(141.000000, 41.000000) scale(-1, 1) translate(-141.000000, -41.000000) '
                    />
                </g>
                <path
                    d='M156,21.5390062 C162.772319,26.1359565 167,32.6563196 167,39.8878801 C167,47.2887711 162.572015,53.9447688 155.520105,58.5564942 L149.57933,53.8764929 L145,54.207887 L146,51.0567821 L145.922229,50.995516 C152.022491,47.8530505 156,42.7003578 156,36.8768102 L156,21.5390062 Z M108,21.5390062 C101.227681,26.1359565 97,32.6563196 97,39.8878801 C97,47.2887711 101.427985,53.9447688 108.479895,58.5564942 L114.42067,53.8764929 L119,54.207887 L118,51.0567821 L118.077771,50.995516 C111.977509,47.8530505 108,42.7003578 108,36.8768102 L108,21.5390062 Z'
                    id='Collar'
                    fill='#F2F2F2'
                    fillRule='evenodd'
                />
            </g>
        )
    }
}

class CollarSweater extends React.Component<{color: ColorFabric}> {
    static optionValue = 'CollarSweater';

    private path1 = uniqueId('react-path-');
    private mask1 = uniqueId('react-mask-');

    render() {
        const {path1, mask1} = this;
        return (
            <g
                id='Clothing/Collar-+-Sweater'
                transform='translate(0.000000, 170.000000)'>
                <defs>
                    <path
                        d='M105.192402,29.0517235 L104,29.0517235 L104,29.0517235 C64.235498,29.0517235 32,61.2872215 32,101.051724 L32,110 L232,110 L232,101.051724 C232,61.2872215 199.764502,29.0517235 160,29.0517235 L160,29.0517235 L158.807598,29.0517235 C158.934638,30.0353144 159,31.0364513 159,32.0517235 C159,45.8588423 146.911688,57.0517235 132,57.0517235 C117.088312,57.0517235 105,45.8588423 105,32.0517235 C105,31.0364513 105.065362,30.0353144 105.192402,29.0517235 Z'
                        id={path1}
                    />
                </defs>
                <mask id={mask1} fill='white'>
                    <use xlinkHref={'#' + path1} />
                </mask>
                <use
                    id='Clothes'
                    fill='#E6E6E6'
                    fillRule='evenodd'
                    xlinkHref={'#' + path1}
                />
                <Colors maskID={mask1} color={this.props.color} />
                <path
                    d='M156,22.2794906 C162.181647,26.8351858 166,33.1057265 166,40.027915 C166,47.2334941 161.862605,53.7329769 155.228997,58.3271669 L149.57933,53.8764929 L145,54.207887 L146,51.0567821 L145.922229,50.995516 C152.022491,47.8530505 156,42.7003578 156,36.8768102 L156,22.2794906 Z M108,21.5714994 C101.232748,26.1740081 97,32.7397769 97,40.027915 C97,47.4261549 101.361602,54.080035 108.308428,58.6915723 L114.42067,53.8764929 L119,54.207887 L118,51.0567821 L118.077771,50.995516 C111.977509,47.8530505 108,42.7003578 108,36.8768102 L108,21.5714994 Z'
                    id='Collar'
                    fill='#F2F2F2'
                    fillRule='evenodd'
                />
            </g>
        )
    }
}

class GraphicShirt extends React.Component<{color: ColorFabric; graphic: ClothesGraphic}> {
    public static optionValue = "GraphicShirt";

    private path1 = uniqueId("react-path-");
    private mask1 = uniqueId("react-mask-");

    public render(): JSX.Element {
        const {path1, mask1} = this;
        return (
            <g
                id="Clothing/Graphic-Shirt"
                transform="translate(0.000000, 170.000000)">
                <defs>
                    <path
                        d="M165.624032,29.2681342 C202.760022,32.1373245 232,63.1798426 232,101.051724 L232,110 L32,110 L32,101.051724 C32,62.8348009 61.7752018,31.5722494 99.3929298,29.1967444 C99.1342224,30.2735458 99,31.3767131 99,32.5 C99,44.3741221 113.998461,54 132.5,54 C151.001539,54 166,44.3741221 166,32.5 C166,31.4015235 165.871641,30.3222877 165.624025,29.2681336 Z"
                        id={path1}
                    />
                </defs>
                <mask id={mask1} fill="white">
                    <use xlinkHref={`#${path1}`} />
                </mask>
                <use
                    id="Clothes"
                    fill="#E6E6E6"
                    fillRule="evenodd"
                    xlinkHref={"#" + path1}
                />
                <Colors maskID={mask1} color={this.props.color} />
                <Graphics maskID={mask1} graphic={this.props.graphic} />
            </g>
        );
    }
}

class Hoodie extends React.Component<{color: ColorFabric}> {
    static optionValue = 'Hoodie';

    private path1 = uniqueId('react-path-');
    private mask1 = uniqueId('react-mask-');

    render(): JSX.Element {
        const {path1, mask1} = this;
        return (
            <g id='Clothing/Hoodie' transform='translate(0.000000, 170.000000)'>
                <defs>
                    <path
                        d='M108,13.0708856 C90.0813006,15.075938 76.2798424,20.5518341 76.004203,34.6449676 C50.1464329,45.5680933 32,71.1646257 32,100.999485 L32,100.999485 L32,110 L232,110 L232,100.999485 C232,71.1646257 213.853567,45.5680933 187.995797,34.6449832 C187.720158,20.5518341 173.918699,15.075938 156,13.0708856 L156,32 L156,32 C156,45.254834 145.254834,56 132,56 L132,56 C118.745166,56 108,45.254834 108,32 L108,13.0708856 Z'
                        id={path1}
                    />
                </defs>
                <mask id={mask1} fill='white'>
                    <use xlinkHref={'#' + path1} />
                </mask>
                <use
                    id='Hoodie'
                    fill='#B7C1DB'
                    fillRule='evenodd'
                    xlinkHref={'#' + path1}
                />
                <Colors maskID={mask1} color={this.props.color} />
                <path
                    d='M102,61.7390531 L102,110 L95,110 L95,58.1502625 C97.2037542,59.4600576 99.5467694,60.6607878 102,61.7390531 Z M169,58.1502625 L169,98.5 C169,100.432997 167.432997,102 165.5,102 C163.567003,102 162,100.432997 162,98.5 L162,61.7390531 C164.453231,60.6607878 166.796246,59.4600576 169,58.1502625 Z'
                    id='Straps'
                    fill='#F4F4F4'
                    fillRule='evenodd'
                    mask={`url(#${mask1})`}
                />
                <path
                    d='M90.9601329,12.7243537 C75.9093095,15.5711782 65.5,21.2428847 65.5,32.3076923 C65.5,52.0200095 98.5376807,68 132,68 C165.462319,68 198.5,52.0200095 198.5,32.3076923 C198.5,21.2428847 188.09069,15.5711782 173.039867,12.7243537 C182.124921,16.0744598 188,21.7060546 188,31.0769231 C188,51.4689754 160.178795,68 132,68 C103.821205,68 76,51.4689754 76,31.0769231 C76,21.7060546 81.8750795,16.0744598 90.9601329,12.7243537 Z'
                    id='Shadow'
                    fillOpacity='0.16'
                    fill='#000000'
                    fillRule='evenodd'
                    mask={`url(#${mask1})`}
                />
            </g>
        )
    }
}

class Overall extends React.Component<{color: ColorFabric}> {
    public static optionValue = "Overall";

    private path1 = uniqueId("react-path-");
    private mask1 = uniqueId("react-mask-");

    public render() {
        const {path1, mask1} = this;
        return (
            <g id="Clothing/Overall" transform="translate(0.000000, 170.000000)">
                <defs>
                    <path
                        d="M94,29.6883435 L94,74 L170,74 L170,29.6883435 C179.362956,30.9893126 188.149952,34.0907916 196.00002,38.6318143 L196,110 L187,110 L77,110 L68,110 L68,38.6318027 C75.8500482,34.0907916 84.6370437,30.9893126 94,29.6883435 Z"
                        id={path1}
                    />
                </defs>
                <mask id={mask1} fill="white">
                    <use xlinkHref={"#" + path1} />
                </mask>
                <use
                    id="Overall"
                    fill="#B7C1DB"
                    fillRule="evenodd"
                    xlinkHref={"#" + path1}
                />
                <Colors maskID={mask1} color={this.props.color} />
                <circle
                    id="Button"
                    fill="#F4F4F4"
                    fillRule="evenodd"
                    cx="81"
                    cy="83"
                    r="5"
                />
                <circle
                    id="Button"
                    fill="#F4F4F4"
                    fillRule="evenodd"
                    cx="183"
                    cy="83"
                    r="5"
                />
            </g>
        );
    }
}


class ShirtCrewNeck extends React.Component<{color: ColorFabric}> {
    static optionValue = "ShirtCrewNeck";
    private path1 = uniqueId("react-path-");
    private mask1 = uniqueId("react-mask-");

    render() {
        const {path1, mask1} = this;
        return (
            <g
                id="Clothing/Shirt-Crew-Neck"
                transform="translate(0.000000, 170.000000)">
                <defs>
                    <path
                        d="M165.960472,29.2949161 C202.936473,32.3249982 232,63.2942856 232,101.051724 L232,110 L32,110 L32,101.051724 C32,62.9525631 61.591985,31.7649812 99.0454063,29.2195264 C99.0152598,29.5931145 99,29.9692272 99,30.3476251 C99,42.2107177 113.998461,51.8276544 132.5,51.8276544 C151.001539,51.8276544 166,42.2107177 166,30.3476251 C166,29.9946691 165.986723,29.6437014 165.960472,29.2949161 Z"
                        id={path1}
                    />
                </defs>
                <mask id={mask1} fill="white">
                    <use xlinkHref={"#" + path1} />
                </mask>
                <use
                    id="Clothes"
                    fill="#E6E6E6"
                    fillRule="evenodd"
                    xlinkHref={"#" + path1}
                />
                <Colors maskID={mask1} color={this.props.color} />
                <g
                    id="Shadowy"
                    opacity="0.599999964"
                    strokeWidth="1"
                    fillRule="evenodd"
                    mask={`url(#${mask1})`}
                    fillOpacity="0.16"
                    fill="#000000">
                    <g transform="translate(92.000000, 4.000000)" id="Hola-👋🏼">
                        <ellipse
                            cx="40.5"
                            cy="27.8476251"
                            rx="39.6351047"
                            ry="26.9138272"
                        />
                    </g>
                </g>
            </g>
        )
    }
}

class ShirtScoopNeck extends React.Component<{color: ColorFabric}> {
    static optionValue = 'ShirtScoopNeck';
    private path1 = uniqueId('react-path-');
    private mask1 = uniqueId('react-mask-');

    render() {
        const {path1, mask1} = this;
        return (
            <g
                id='Clothing/Shirt-Scoop-Neck'
                transform='translate(0.000000, 170.000000)'>
                <defs>
                    <path
                        d='M181.544255,32.3304167 C210.784209,41.4878872 232,68.7921987 232,101.051724 L232,110 L32,110 L32,101.051724 C32,68.3969699 53.7388273,40.8195914 83.5340368,32.0020332 C83.182234,33.4201865 83,34.8712315 83,36.3476251 C83,52.6289957 105.161905,65.8276544 132.5,65.8276544 C159.838095,65.8276544 182,52.6289957 182,36.3476251 C182,34.9849859 181.844766,33.6439396 181.544255,32.3304167 Z'
                        id={path1}
                    />
                </defs>
                <mask id={mask1} fill='white'>
                    <use xlinkHref={'#' + path1} />
                </mask>
                <use
                    id='Clothes'
                    fill='#E6E6E6'
                    fillRule='evenodd'
                    xlinkHref={'#' + path1}
                />
                <Colors maskID={mask1} color={this.props.color} />
            </g>
        )
    }
}

class ShirtVNeck extends React.Component<{color: ColorFabric}> {
    static optionValue = "ShirtVNeck";
    private path1 = uniqueId("react-path-");
    private mask1 = uniqueId("react-mask-");

    public render() {
        const {path1, mask1} = this;
        return (
            <g id="Clothing/Shirt-V-Neck" transform="translate(0.000000, 170.000000)">
                <defs>
                    <path
                        d="M171.319631,29.9364358 C205.706337,35.3665707 232,65.13854 232,101.051724 L232,110 L32,110 L32,101.051724 C32,65.1380521 58.2943778,35.3657617 92.6817711,29.9362145 C93.5835973,35.0053598 96.116393,39.8238432 100.236125,43.5389794 L100.236125,43.5389794 L129.321203,69.7676333 C130.843316,71.1402598 133.156684,71.1402598 134.678797,69.7676333 L134.678797,69.7676333 L163.763875,43.5389794 C164.189462,43.1551884 164.601167,42.7562772 164.998197,42.3430127 C168.414164,38.7873666 170.517305,34.4520434 171.319628,29.9364354 Z"
                        id={path1}
                    />
                </defs>
                <mask id={mask1} fill="white">
                    <use xlinkHref={"#" + path1} />
                </mask>
                <use
                    id="Clothes"
                    fill="#E6E6E6"
                    fillRule="evenodd"
                    xlinkHref={"#" + path1}
                />
                <Colors maskID={mask1} color={this.props.color} />
            </g>
        )
    }
}
