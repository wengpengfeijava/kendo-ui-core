﻿<%@ Page Title="" Language="C#" MasterPageFile="~/Areas/aspx/Views/Shared/Web.Master" Inherits="System.Web.Mvc.ViewPage<dynamic>" %>

<asp:Content ContentPlaceHolderID="HeadContent" runat="server">
</asp:Content>

<asp:Content ContentPlaceHolderID="MainContent" runat="server">

<%= Html.Kendo().Notification()
    .Name("popupNotification")
%>

<%= Html.Kendo().Notification()
    .Name("staticNotification")
    .AppendTo("#appendto")
%>

         <div class="demo-section k-content">
            <h4>Show notification</h4>
            <p>
                <button id="showPopupNotification" class="k-button">As a popup at bottom-right</button><br />
                <button id="showStaticNotification" class="k-button">Static in the panel below</button>
            </p>
            <div style="padding-top: 1em;">
                <h4>Hide notification</h4>
                <button id="hideAllNotifications" class="k-button">Hide All Notifications</button>
            </div>
        </div>
        
        <div id="appendto" class="demo-section k-content"></div>

        <style>
            .demo-section {
                text-align: center;
                line-height: 4em;
            }
            .demo-section .k-button {
                width: 250px;
            }
        </style>

        <script>
            $(document).ready(function () {
                var popupNotification = $("#popupNotification").data("kendoNotification");
                var staticNotification = $("#staticNotification").data("kendoNotification");

                $("#showPopupNotification").click(function () {
                    var d = new Date();
                    popupNotification.show(kendo.toString(d, 'HH:MM:ss.') + kendo.toString(d.getMilliseconds(), "000"), "error");
                });

                $("#showStaticNotification").click(function () {
                    var d = new Date();
                    staticNotification.show(kendo.toString(d, 'HH:MM:ss.') + kendo.toString(d.getMilliseconds(), "000"), "info");
                    var container = $(staticNotification.options.appendTo);
                    container.scrollTop(container[0].scrollHeight);
                });

                $("#hideAllNotifications").click(function () {
                    popupNotification.hide();
                    staticNotification.hide();
                });
            });
        </script>

</asp:Content>