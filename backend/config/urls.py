"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

from rest_framework import routers
from expenses.views import (
    ExpenseViewSet,
    MonthlySummaryView,
    MonthlySummaryListView,
    RakutenCSVImportView,
    MitsuiCSVImportView,
    MonthStatusUpdateView,
    ExclusionRuleViewSet,
    MonthlyCategorySummaryView,
    YearlySummaryView,
    AppSettingsView,
    StoreSuggestionsView,
)

router = routers.DefaultRouter()
router.register(r"expenses", ExpenseViewSet, basename="expense")
router.register(r"exclusion-rules", ExclusionRuleViewSet, basename="exclusion-rule")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/summary/monthly/", MonthlySummaryView.as_view(), name="monthly-summary"),
    path("api/summary/monthly-list/", MonthlySummaryListView.as_view(), name="monthly-summary-list"),
    path("api/summary/monthly-by-category/", MonthlyCategorySummaryView.as_view(), name="monthly-category-summary"),
    path("api/summary/yearly/", YearlySummaryView.as_view(), name="yearly-summary"),
    path("api/stores/suggestions/", StoreSuggestionsView.as_view(), name="store-suggestions"),
    path("api/import/rakuten/", RakutenCSVImportView.as_view(), name="import-rakuten"),
    path("api/import/mitsui/", MitsuiCSVImportView.as_view(), name="import-mitsui"),
    path("api/settings/", AppSettingsView.as_view(), name="app-settings"),
    path("api/month/status/", MonthStatusUpdateView.as_view(), name="month-status"), 
]
