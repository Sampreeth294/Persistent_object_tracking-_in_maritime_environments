import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { Empty } from "../components/ui";

export default function NotFound() {
  return (
    <div className="p-6">
      <div className="panel">
        <Empty title="Page not found" icon={Compass} action={<Link to="/" className="btn btn-primary">Back to overview</Link>}>
          This address doesn't match any page in the console.
        </Empty>
      </div>
    </div>
  );
}
