// Code generated by templ - DO NOT EDIT.

// templ: version: v0.3.865
package templates

//lint:file-ignore SA4006 This context is only used if a nested component is present.

import "github.com/a-h/templ"
import templruntime "github.com/a-h/templ/runtime"

func ConfigDialog(kubeHost string, ver string) templ.Component {
	return templruntime.GeneratedTemplate(func(templ_7745c5c3_Input templruntime.GeneratedComponentInput) (templ_7745c5c3_Err error) {
		templ_7745c5c3_W, ctx := templ_7745c5c3_Input.Writer, templ_7745c5c3_Input.Context
		if templ_7745c5c3_CtxErr := ctx.Err(); templ_7745c5c3_CtxErr != nil {
			return templ_7745c5c3_CtxErr
		}
		templ_7745c5c3_Buffer, templ_7745c5c3_IsBuffer := templruntime.GetBuffer(templ_7745c5c3_W)
		if !templ_7745c5c3_IsBuffer {
			defer func() {
				templ_7745c5c3_BufErr := templruntime.ReleaseBuffer(templ_7745c5c3_Buffer)
				if templ_7745c5c3_Err == nil {
					templ_7745c5c3_Err = templ_7745c5c3_BufErr
				}
			}()
		}
		ctx = templ.InitializeContext(ctx)
		templ_7745c5c3_Var1 := templ.GetChildren(ctx)
		if templ_7745c5c3_Var1 == nil {
			templ_7745c5c3_Var1 = templ.NopComponent
		}
		ctx = templ.ClearChildren(ctx)
		templ_7745c5c3_Err = templruntime.WriteString(templ_7745c5c3_Buffer, 1, "<div class=\"modal is-active\" id=\"configDialog\" x-data=\"{ cfg: getConfig(), tab: 1, activeNS: activeNamespace() }\"><div class=\"modal-background\"></div><div class=\"modal-card\"><header class=\"modal-card-head has-background-primary py-3\"><p class=\"modal-card-title has-text-black\">Settings</p><button class=\"delete\" aria-label=\"close\" hx-get=\"empty\" hx-target=\"#dialogs\"></button></header><div class=\"modal-content has-background-dark\" style=\"min-height: 330px\"><section class=\"my-2 mx-2\"><div class=\"tabs\"><ul><li :class=\"{&#39;is-active&#39;:tab==1}\" @click=\"tab=1\"><a>General</a></li><li :class=\"{&#39;is-active&#39;:tab==2}\" @click=\"tab=2\"><a>Filters</a></li><li :class=\"{&#39;is-active&#39;:tab==3}\" @click=\"tab=3\"><a>About</a></li></ul></div></section><section class=\"mx-5 my-3\"><div :class=\"{&#39;is-hidden&#39;:tab!=1}\"><label class=\"label\">Options</label><div class=\"field\"><label class=\"checkbox\"><input type=\"checkbox\" x-model=\"cfg.shortenNames\"> Shorten Names</label><p class=\"help\">Removes hash details from Pod & ReplicaSet names</p></div><div class=\"field mt-4\"><label class=\"checkbox\"><input type=\"checkbox\" x-model=\"cfg.debug\"> Debug</label><p class=\"help\">Extra logging in the console</p></div></div><div :class=\"{&#39;is-hidden&#39;:tab!=2}\"><label class=\"label\">Resource Filters (Hold Ctrl to select multiple)</label><div class=\"field\"><div class=\"select is-multiple\"><select multiple size=\"6\" x-model=\"cfg.resFilter\"><option value=\"Pod\" :selected=\"cfg.resFilter.includes(&#39;Pod&#39;)\">Pods</option> <option value=\"Service\" :selected=\"cfg.resFilter.includes(&#39;Service&#39;)\">Services</option> <option value=\"Deployment\" :selected=\"cfg.resFilter.includes(&#39;Deployment&#39;)\">Deployments</option> <option value=\"StatefulSet\" :selected=\"cfg.resFilter.includes(&#39;StatefulSet&#39;)\">StatefulSets</option> <option value=\"DaemonSet\" :selected=\"cfg.resFilter.includes(&#39;DaemonSet&#39;)\">DaemonSets</option> <option value=\"ReplicaSet\" :selected=\"cfg.resFilter.includes(&#39;ReplicaSet&#39;)\">ReplicaSets</option> <option value=\"Job\" :selected=\"cfg.resFilter.includes(&#39;Job&#39;)\">Jobs</option> <option value=\"CronJob\" :selected=\"cfg.resFilter.includes(&#39;CronJob&#39;)\">CronJobs</option> <option value=\"Ingress\" :selected=\"cfg.resFilter.includes(&#39;Ingress&#39;)\">Ingress</option> <option value=\"ConfigMap\" :selected=\"cfg.resFilter.includes(&#39;ConfigMap&#39;)\">ConfigMaps</option> <option value=\"Secret\" :selected=\"cfg.resFilter.includes(&#39;Secret&#39;)\">Secrets</option> <option value=\"PersistentVolume\" :selected=\"cfg.resFilter.includes(&#39;PersistentVolume&#39;)\">PersistentVolumes</option> <option value=\"PersistentVolumeClaim\" :selected=\"cfg.resFilter.includes(&#39;PersistentVolumeClaim&#39;)\">PersistentVolumeClaims</option></select></div></div></div><div :class=\"{&#39;is-hidden&#39;:tab!=3}\"><div class=\"field\"><label class=\"label\">Kubernetes Cluster</label><p>")
		if templ_7745c5c3_Err != nil {
			return templ_7745c5c3_Err
		}
		var templ_7745c5c3_Var2 string
		templ_7745c5c3_Var2, templ_7745c5c3_Err = templ.JoinStringErrs(kubeHost)
		if templ_7745c5c3_Err != nil {
			return templ.Error{Err: templ_7745c5c3_Err, FileName: `server/templates/config.templ`, Line: 68, Col: 20}
		}
		_, templ_7745c5c3_Err = templ_7745c5c3_Buffer.WriteString(templ.EscapeString(templ_7745c5c3_Var2))
		if templ_7745c5c3_Err != nil {
			return templ_7745c5c3_Err
		}
		templ_7745c5c3_Err = templruntime.WriteString(templ_7745c5c3_Buffer, 2, "</p></div><div class=\"field\"><label class=\"label\">Version</label><p>v")
		if templ_7745c5c3_Err != nil {
			return templ_7745c5c3_Err
		}
		var templ_7745c5c3_Var3 string
		templ_7745c5c3_Var3, templ_7745c5c3_Err = templ.JoinStringErrs(ver)
		if templ_7745c5c3_Err != nil {
			return templ.Error{Err: templ_7745c5c3_Err, FileName: `server/templates/config.templ`, Line: 72, Col: 16}
		}
		_, templ_7745c5c3_Err = templ_7745c5c3_Buffer.WriteString(templ.EscapeString(templ_7745c5c3_Var3))
		if templ_7745c5c3_Err != nil {
			return templ_7745c5c3_Err
		}
		templ_7745c5c3_Err = templruntime.WriteString(templ_7745c5c3_Buffer, 3, "</p></div><div class=\"field\"><label class=\"label\">Project</label> <a class=\"button is-dark\" href=\"https://github.com/benc-uk/kubeview2\" target=\"_blank\"><span class=\"icon\"><i class=\"fab fa-github\"></i></span> <span>github.com/benc-uk/kubeview2</span></a></div></div></section></div><footer class=\"modal-card-foot\"><div class=\"buttons\"><!-- Note TWO htmx calls happen when save is clicked: /load and /empty --><div hx-get=\"load\" hx-on::before-send=\"reset()\" hx-include=\"#nsValue\" hx-target=\"#dummy\" hx-indicator=\"#spinner\" hx-trigger=\"click\"><input type=\"hidden\" name=\"namespace\" :value=\"activeNS\" id=\"nsValue\"> <button class=\"button is-success\" hx-get=\"empty\" hx-target=\"#dialogs\" @click=\"saveConfig(cfg);\">Save changes</button></div><button class=\"button\" hx-get=\"empty\" hx-target=\"#dialogs\">Cancel</button></div></footer></div></div>")
		if templ_7745c5c3_Err != nil {
			return templ_7745c5c3_Err
		}
		return nil
	})
}

var _ = templruntime.GeneratedTemplate
