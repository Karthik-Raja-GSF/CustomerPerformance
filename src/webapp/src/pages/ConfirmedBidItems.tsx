import CustomerBids from "@/pages/CustomerBids";

export default function ConfirmedBidItems() {
  return (
    <CustomerBids
      pageTitle="Confirmed Bid Items"
      pageDescription="View confirmed customer bid items"
      defaultConfirmed={true}
      canUnconfirm={false}
      showSIQExport={true}
      showCSVExport={false}
      showConfirmedFilter={false}
      defaultColumnVisibility={{
        isLost: false,
        bidStartDate: false,
        bidEndDate: false,
        lastYearBidQty: false,
        lastYearActual: false,
        conversionRate: false,
        lyAugust: false,
        lySeptember: false,
        lyOctober: false,
      }}
    />
  );
}
