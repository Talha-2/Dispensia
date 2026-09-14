import { redirect } from "next/navigation";

/**
 * Stock used to be its own screen. It was the catalogue with one filter locked,
 * which meant two pages, two toolbars and two sets of filters over one dataset.
 * The scope toggle in the catalogue does the whole job, so this route now points
 * there — existing links, bookmarks and the dashboard's drill-downs keep working.
 */
export default function InventoryPage() {
  redirect("/catalogue?scope=stocked");
}
