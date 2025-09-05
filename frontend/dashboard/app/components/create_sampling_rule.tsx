"use client"

import { Button } from "@/app/components/button";
import { Plus } from "lucide-react";

interface CreateSamplingRuleProps {
  onSelect?: () => void;
}

const CreateSamplingRule: React.FC<CreateSamplingRuleProps> = ({ onSelect }) => {
  const handleClick = () => {
    if (onSelect) onSelect();
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
