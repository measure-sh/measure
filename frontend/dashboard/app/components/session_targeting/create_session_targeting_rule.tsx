"use client"

import { Button } from "@/app/components/button";
import { Plus } from "lucide-react";

interface CreateSamplingRuleProps {
  onSelect?: () => void;
  disabled?: boolean;
}

const CreateSessionTargetingRule: React.FC<CreateSamplingRuleProps> = ({ onSelect, disabled }) => {
  const handleClick = () => {
    if (onSelect && !disabled) onSelect();
  };

  return (
    <Button
      variant="outline"
      className="font-display border border-black select-none"
      onClick={handleClick}
      disabled={disabled}
    >
      <Plus /> Create Rule
    </Button>
  );
};

export default CreateSessionTargetingRule;
