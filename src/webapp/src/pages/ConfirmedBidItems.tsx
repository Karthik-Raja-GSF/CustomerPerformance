import CustomerBids from "@/pages/CustomerBids";

export default function ConfirmedBidItems() {
  return (
    <CustomerBids
      pageTitle="Confirmed Bid Items"
      pageDescription="View confirmed customer bid items"
      defaultConfirmed={true}
      defaultExported={false}
      defaultQueued={false}
      canUnconfirm={false}
      showNAVExport={true}
      showCSVExport={false}
      showCSVImport={false}
      showConfirmedFilter={false}
      showExportedFilter={true}
      showQueueExport={true}
      defaultColumnVisibility={{
        isNew: false,
        bidStartDate: false,
        bidEndDate: false,
        lastYearBidQty: false,
        lastYearActual: false,
        conversionRate: false,
        lyAugust: false,
        lySeptember: false,
        lyOctober: false,
        lyNovember: false,
        lyDecember: false,
        lyJanuary: false,
        lyFebruary: false,
        lyMarch: false,
        lyApril: false,
        lyMay: false,
        lyJune: false,
        lyJuly: false,
        cyAugust: false,
        cySeptember: false,
        cyOctober: false,
        cyNovember: false,
        cyDecember: false,
        cyJanuary: false,
        cyFebruary: false,
        cyMarch: false,
        cyApril: false,
        cyMay: false,
        cyJune: false,
        cyJuly: false,
        cyYtd: false,
      }}
    />
  );
}
