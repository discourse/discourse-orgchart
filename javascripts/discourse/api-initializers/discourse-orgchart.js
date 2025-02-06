/* global d3 */
import { later } from "@ember/runloop";
import { apiInitializer } from "discourse/lib/api";
import { getURLWithCDN } from "discourse/lib/get-url";
import loadScript from "discourse/lib/load-script";

const d3_script = settings.theme_uploads_local.d3;
const d3_orgchart_script = settings.theme_uploads_local.d3_orgchart;
const d3_flextree_script = settings.theme_uploads_local.d3_flextree;

async function applyOrgChart(element, key = "composer") {
  let orgcharts = element.querySelectorAll("pre[data-code-wrap=orgchart]");

  if (!orgcharts.length) {
    return;
  }

  orgcharts.forEach((orgchart) => {
    if (orgchart.dataset.processed) {
      return;
    }

    const spinner = document.createElement("div");
    spinner.classList.add("spinner");

    if (orgchart.dataset.codeHeight && key !== "composer") {
      orgchart.style.height = `${orgchart.dataset.codeHeight}px`;
    }

    later(() => {
      if (!orgchart.dataset.processed) {
        orgchart.append(spinner);
      }
    }, 2000);
  });

  orgcharts = element.querySelectorAll("pre[data-code-wrap=orgchart]");
  orgcharts.forEach(async (orgchart) => {
    if (orgchart.dataset.processed) {
      return;
    }

    const code = orgchart.querySelector("code");

    if (!code) {
      orgchart.dataset.processed = "true";
      return;
    }

    await cookOrgChart(code);

    orgchart.dataset.processed = "true";
  });
}

async function cookOrgChart(element) {
  await loadScript(d3_script);
  await loadScript(d3_orgchart_script);
  await loadScript(d3_flextree_script);

  let headers = element.innerText
    .split("---")[0]
    .split(",")
    .map((e) => e.trim());
  let dataFlattened = d3
    .csvParseRows(element.innerText.split("---")[1], (d) => {
      return Object.fromEntries(
        d.map((column, index) => [headers[index], column])
      );
    })
    .filter((e) => e.name);

  new d3.OrgChart()
    .container(element.parentElement.parentElement)
    .data(dataFlattened)
    .svgHeight(parseInt(element.clientHeight, 10))
    .nodeHeight(() => 70)
    .nodeWidth((d) => {
      if (d.depth < 3) {
        return 250;
      }
      return 180;
    })
    .childrenMargin(() => 50)
    .compactMarginBetween(() => 35)
    .compactMarginPair(() => 30)
    .neightbourMargin(() => 20)
    .buttonContent(({ node }) => {
      return `<div style="border-radius:3px;padding:3px;font-size:10px;margin:auto auto;background-color:lightgray"> <span style="font-size:9px;color: black;">${
        node.children ? `⬆️` : `⬇️`
      } ${node.data._directSubordinates}</span></div>`;
    })
    .nodeContent(function (d) {
      const colors = ["#278B8D", "#404040", "#0C5C73", "#33C6CB"];
      const color = colors[d.depth % colors.length];
      return `
          <a href="/u/${d.data.id}">
            <div style="background-color:${color}; position:absolute;margin-top:-1px; margin-left:-1px;width:${d.width}px;height:${d.height}px;border-radius:50px">
               <img src=" ${getURLWithCDN(
                 d.data.imageUrl
               )}" style="position:absolute;margin-top:5px;margin-left:${5}px;border-radius:100px;width:60px;height:60px;" />
               <div style="position:absolute;top:-15px;width:${
                 d.width
               }px;text-align:center;color:#fafafa;">
                     <div style="margin:0 auto;background-color:${color};display:inline-block;padding:8px;padding-bottom:0px;border-radius:5px"> ${d.data.id}</div>
              </div>

              <div style="color:#fafafa;font-size:${
                d.depth < 2 ? 16 : 12
              }px;font-weight:bold;margin-left:70px;margin-top:15px"> ${d.depth < 2 ? d.data.name : (d.data.name || "").trim().split(/\s+/g)[0]} </div>
              <div style="color:#fafafa;margin-left:70px;margin-top:5px"> ${
                d.data.positionName
              } </div>

               <!--
               <div style="padding:20px; padding-top:35px;text-align:center">


               </div>

               <div style="display:flex;justify-content:space-between;padding-left:15px;padding-right:15px;">
                 <div > Manages:  ${d.data._directSubordinates} 👤</div>
                 <div > Oversees: ${d.data._totalSubordinates} 👤</div>
               </div>
               -->
           </div>
        </a>
  `;
    })
    .render()
    .expandAll()
    .fit();

  element.parentElement.remove();
}

export default apiInitializer("0.11.1", (api) => {
  api.decorateCookedElement(
    async (elem, helper) => {
      const id = helper ? `post_${helper.getModel().id}` : "composer";
      applyOrgChart(elem, id);
    },
    { id: "discourse-orgchart" }
  );
});
