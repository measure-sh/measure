"use client"

import { Button } from "@/app/components/button";
import { Plus } from "lucide-react";

export type SamplingRuleType = "session" | "trace";

interface CreateSamplingRuleProps {
  onSelect?: (type: SamplingRuleType) => void;
}

const CreateSamplingRule: React.FC<CreateSamplingRuleProps> = ({ onSelect }) => {
  const handleClick = () => {
    if (onSelect) onSelect("session");
  };

  return (
    <Button
      variant="outline"
      className="font-display border border-black select-none"
      onClick={handleClick}
    >
      <Plus /> Create rule
    </Button>
  );
};

export default CreateSamplingRule;
